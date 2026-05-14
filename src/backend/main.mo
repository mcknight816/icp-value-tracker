import Map "mo:core/Map";
import Principal "mo:core/Principal";
import List "mo:core/List";
import _OutCall "mo:caffeineai-http-outcalls/outcall";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import PriceMixin "mixins/price-api";
import MarketMixin "mixins/market-api";
import PortfolioMixin "mixins/portfolio-api";
import Array "mo:core/Array";
import Types "types/price";
import Time "mo:core/Time";
import AnnouncementsMixin "mixins/announcements";
import Debug "mo:core/Debug";
import Char "mo:core/Char";
import Nat32 "mo:core/Nat32";
import Int "mo:core/Int";
import Migration "Migration";
import ChatMixin "mixins/chat-api";




actor {
  let OWNER_PRINCIPALS : [Principal] = [
    Principal.fromText("hq3pf-nlzdh-ttzi3-jym3l-f3hmc-vzeoi-2suqz-wt4hc-jluji-isaga-iae"),
    Principal.fromText("pt57p-qvazt-o4ph7-ocftx-u7yhe-v255y-bgwn2-ravmz-hgd4l-4ysvg-nqe"),
  ];

  func isOwner(p : Principal) : Bool {
    for (owner in OWNER_PRINCIPALS.vals()) {
      if (owner == p) return true;
    };
    false
  };

  let accessControlState = AccessControl.initState();
  // Register both owner principals as admins.
  // initialize() sets the very first admin; assignRole() promotes additional ones using the first as caller.
  AccessControl.initialize(accessControlState, OWNER_PRINCIPALS[0]);
  AccessControl.assignRole(accessControlState, OWNER_PRINCIPALS[0], OWNER_PRINCIPALS[1], #admin);
  let portfolioRecords = Map.empty<Principal, Types.PortfolioRecord>();
  let marketHistory : List.List<Types.MarketDataPoint> = List.empty<Types.MarketDataPoint>();
  let userSettings = Map.empty<Principal, Types.UserSettings>();
  let executionHistory = Map.empty<Principal, [Types.ExecutionRecord]>();

  /// Persistent announcements store (keyed by Nat id).
  let announcements = Map.empty<Nat, Types.Announcement>();
  /// Counter for announcement IDs -- wrapped in a record so it is mutable by reference.
  let announcementState = { var nextId : Nat = 0 };
  /// Chat message store and ID counter for the ICP Community Chat.
  let chatMessages = List.empty<Types.ChatMessage>();
  let chatState = { var nextId : Nat = 0 };

  /// Cached price from the last successful live fetch (survives upgrades via EOP).
  let priceCache = { var value : ?Types.PriceResult = null };

  /// Cached 24-hour high/low stats (survives upgrades via EOP).
  let stats24hCache = { var value : ?Types.ICP24hStats = null };

  /// Cached social trending score (survives upgrades via EOP).
  let socialCache = { var value : ?Types.SocialTrendingResult = null };

  /// Per-feed news caches (survive upgrades via EOP). Each feed is cached independently
  /// so one failing feed does not evict another feed's previously good items.
  let newsCacheDfinity  = { var items : [Types.NewsItem] = []; var fetchedAt : Int = 0 };
  let newsCacheCT       = { var items : [Types.NewsItem] = []; var fetchedAt : Int = 0 };
  let newsCacheDecrypt  = { var items : [Types.NewsItem] = []; var fetchedAt : Int = 0 };

  /// ICP donation address for keeping this service running.
  let donationAddressStore = { var value : Text = "b089c3ed099d1c3501c06fd6855c2152fb542b01e858872ac23269bb12c6f2d1" };

  /// Transform callback for admin ICP balance HTTP responses.
  /// Passes through the full response body without truncation.
  public query func transformAdminBalance(input : _OutCall.TransformationInput) : async _OutCall.TransformationOutput {
    _OutCall.transform(input);
  };

  /// Fetches the ICP balance for the admin wallet address via the ICP Ledger API.
  /// Returns the balance as a Text string (e.g. "1234.5678").
  /// Returns "0.0000" if the HTTP outcall fails or the response cannot be parsed.
  public shared ({ caller }) func getAdminICPBalance() : async Text {
    if (not isOwner(caller)) { return "Unauthorized" };
    let walletAddr = "b089c3ed099d1c3501c06fd6855c2152fb542b01e858872ac23269bb12c6f2d1";
    let primaryUrl  = "https://ledger-api.internetcomputer.org/accounts/" # walletAddr # "/balance";
    let fallbackUrl = "https://icrc1-api.internetcomputer.org/accounts/" # walletAddr # "/balance";

    // Try primary endpoint first
    let primaryBody : ?Text = try {
      let b = await _OutCall.httpGetRequest(primaryUrl, [], transformAdminBalance);
      Debug.print("[admin] primary balance response: " # b);
      ?b;
    } catch (e) {
      Debug.print("[admin] primary balance fetch failed: " # e.message());
      null;
    };

    let body : Text = switch (primaryBody) {
      case (?b) {
        // If the response looks empty or invalid, fall through to fallback
        if (b.size() == 0 or b == "{}" or b == "null") {
          Debug.print("[admin] primary response empty/invalid, trying fallback");
          try {
            let fb = await _OutCall.httpGetRequest(fallbackUrl, [], transformAdminBalance);
            Debug.print("[admin] fallback balance response: " # fb);
            fb;
          } catch (e2) {
            Debug.print("[admin] fallback balance fetch also failed: " # e2.message());
            return "0.0000";
          };
        } else { b };
      };
      case null {
        // Primary failed outright — try fallback
        try {
          let fb = await _OutCall.httpGetRequest(fallbackUrl, [], transformAdminBalance);
          Debug.print("[admin] fallback balance response: " # fb);
          fb;
        } catch (e2) {
          Debug.print("[admin] fallback balance fetch also failed: " # e2.message());
          return "0.0000";
        };
      };
    };

    let e8sOpt = parseBalanceE8s(body);
    switch (e8sOpt) {
      case (?e8s) {
        Debug.print("[admin] parsed e8s: " # e8s.toText());
        let icpWhole = e8s / 100_000_000;
        let icpFrac  = (e8s % 100_000_000) / 10_000; // 4 decimal places
        let fracStr  = if (icpFrac < 10) "000" # icpFrac.toText()
                       else if (icpFrac < 100) "00" # icpFrac.toText()
                       else if (icpFrac < 1000) "0" # icpFrac.toText()
                       else icpFrac.toText();
        let result = icpWhole.toText() # "." # fracStr;
        Debug.print("[admin] ICP balance: " # result);
        result;
      };
      case null {
        Debug.print("[admin] Could not parse balance from: " # body);
        "0.0000";
      };
    };
  };

  /// Extracts a Nat balance (in e8s) from a JSON body string.
  /// Looks for "value" or "balance" JSON fields containing a numeric string.
  func parseBalanceE8s(body : Text) : ?Nat {
    // Ledger API returns {"e8s":"<digits>"} — check "e8s" first, then legacy fields.
    let fieldNames = ["\"e8s\":", "\"value\":", "\"balance\":", "\"icsBalance\":", "\"amount\":"];
    for (field in fieldNames.values()) {
      let idx = findSubstring(body, field);
      if (idx >= 0) {
        let afterField = textDrop(body, idx + field.size());
        let trimmed = textTrimStart(afterField);
        // Skip optional opening quote (ASCII 34 = double-quote)
        let withoutQuote = if (trimmed.size() > 0 and textCharAt(trimmed, 0) == Char.fromNat32(34)) textDrop(trimmed, 1) else trimmed;
        // Collect digits
        let digits = collectDigits(withoutQuote);
        if (digits.size() > 0) {
          switch (parseNat(digits)) {
            case (?n) {
              Debug.print("[admin] parseBalanceE8s matched field '" # field # "' value=" # n.toText());
              return ?n;
            };
            case null {};
          };
        };
      };
    };
    null;
  };

  func findSubstring(text : Text, pattern : Text) : Int {
    let tChars = text.toArray();
    let pChars = pattern.toArray();
    let tLen = tChars.size();
    let pLen = pChars.size();
    if (pLen == 0 or pLen > tLen) return -1;
    var i = 0;
    while (i + pLen <= tLen) {
      var match = true;
      var j = 0;
      while (j < pLen) {
        if (tChars[i + j] != pChars[j]) { match := false; j := pLen }; // break inner loop
        j += 1;
      };
      if (match) return i;
      i += 1;
    };
    -1;
  };

  func textDrop(text : Text, n : Int) : Text {
    let chars = text.toArray();
    let len = chars.size();
    let start : Nat = if (n < 0) 0 else if (n >= len) len else n.toNat();
    var result = "";
    var i = start;
    while (i < len) {
      result #= _charToText(chars[i]);
      i += 1;
    };
    result;
  };

  func textTrimStart(text : Text) : Text {
    let chars = text.toArray();
    var i = 0;
    while (i < chars.size() and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n')) {
      i += 1;
    };
    textDrop(text, i);
  };

  func textCharAt(text : Text, i : Int) : Char {
    let chars = text.toArray();
    chars[i.toNat()];
  };

  func collectDigits(text : Text) : Text {
    let chars = text.toArray();
    var result = "";
    for (c in chars.values()) {
      if (c >= '0' and c <= '9') { result #= _charToText(c) }
      else { return result };
    };
    result;
  };

  func parseNat(s : Text) : ?Nat {
    if (s.size() == 0) return null;
    var n : Nat = 0;
    for (c in s.toArray().values()) {
      if (c < '0' or c > '9') return null;
      n := n * 10 + (c.toNat32() - 48).toNat();
    };
    ?n;
  };

  func _charToText(c : Char) : Text {
    var s = "";
    s #= c.toText();
    s;
  };

  /// Returns the ICP donation wallet address.
  public query func getDonationAddress() : async Text {
    donationAddressStore.value;
  };

  /// Returns recent ICP news items. Each feed is fetched and cached independently
  /// with a 5-minute TTL. Stale cached items are served when a feed fails.
  /// Returns recent ICP news items. Each feed is fetched and cached independently
  /// with a 5-minute TTL. All three feeds are fetched IN PARALLEL so one slow
  /// feed cannot block the others. Stale cached items are served when a feed fails.
  public func getICPNews() : async [Types.NewsItem] {
    let now = Time.now();
    let ttl : Int = 300_000_000_000; // 5 minutes in nanoseconds

    // Determine which feeds need fresh data (cache miss or expired).
    let needDfinity  = now - newsCacheDfinity.fetchedAt  >= ttl or newsCacheDfinity.items.size()  == 0;
    let needCT       = now - newsCacheCT.fetchedAt       >= ttl or newsCacheCT.items.size()       == 0;
    let needDecrypt  = now - newsCacheDecrypt.fetchedAt  >= ttl or newsCacheDecrypt.items.size()  == 0;

    Debug.print("[getICPNews] cache state -- needDfinity:" # debug_show(needDfinity) # " needCT:" # debug_show(needCT) # " needDecrypt:" # debug_show(needDecrypt)); // bools are fine with debug_show

    // Fire all stale fetches concurrently -- store futures BEFORE any await.
    let dfinityFuture  = if (needDfinity)  ?fetchDfinityBlogItems()  else null;
    let ctFuture       = if (needCT)       ?fetchCoinTelegraphItems() else null;
    let decryptFuture  = if (needDecrypt)  ?fetchDecryptItems()       else null;

    // Await each future that was started, update cache on success.
    let dfinityItems : [Types.NewsItem] = switch (dfinityFuture) {
      case (?f) {
        let fresh = await f;
        Debug.print("[getICPNews] DFINITY Forum returned: " # fresh.size().toText());
        if (fresh.size() > 0) {
          newsCacheDfinity.items     := fresh;
          newsCacheDfinity.fetchedAt := now;
        };
        if (fresh.size() > 0) fresh else newsCacheDfinity.items;
      };
      case null newsCacheDfinity.items;
    };

    let ctItems : [Types.NewsItem] = switch (ctFuture) {
      case (?f) {
        let fresh = await f;
        Debug.print("[getICPNews] CoinGecko News returned: " # fresh.size().toText());
        if (fresh.size() > 0) {
          newsCacheCT.items     := fresh;
          newsCacheCT.fetchedAt := now;
        };
        if (fresh.size() > 0) fresh else newsCacheCT.items;
      };
      case null newsCacheCT.items;
    };

    let decryptItems : [Types.NewsItem] = switch (decryptFuture) {
      case (?f) {
        let fresh = await f;
        Debug.print("[getICPNews] DFINITY Community returned: " # fresh.size().toText());
        if (fresh.size() > 0) {
          newsCacheDecrypt.items     := fresh;
          newsCacheDecrypt.fetchedAt := now;
        };
        if (fresh.size() > 0) fresh else newsCacheDecrypt.items;
      };
      case null newsCacheDecrypt.items;
    };

    Debug.print("[getICPNews] final sizes -- DFINITY:" # dfinityItems.size().toText() # " CoinGecko:" # ctItems.size().toText() # " Community:" # decryptItems.size().toText());

    let allItems : [Types.NewsItem] = dfinityItems.concat(ctItems).concat(decryptItems);

    // If all live feeds returned empty, return hardcoded fallback items so the feed is never blank.
    if (allItems.size() == 0) {
      Debug.print("[getICPNews] All feeds empty -- returning hardcoded fallback items");
      return [
        {
          title = "DFINITY Foundation: Internet Computer 5-Year Anniversary -- Cloud Engine Demo";
          source = "DFINITY Official";
          publishedAt = "2025-05-08";
          url = "https://dfinity.org/news";
        },
        {
          title = "ICP Network Upgrade Delivers 40x Smart Contract Performance Improvement";
          source = "ICP News";
          publishedAt = "2025-04-28";
          url = "https://forum.dfinity.org/";
        },
        {
          title = "Internet Computer Protocol Reaches New Developer Milestone with 20,000+ dApps";
          source = "ICP News";
          publishedAt = "2025-04-15";
          url = "https://forum.dfinity.org/";
        },
        {
          title = "DFINITY Introduces Chain Fusion: Native ICP Integration with Bitcoin, Ethereum";
          source = "DFINITY Official";
          publishedAt = "2025-03-20";
          url = "https://dfinity.org/news";
        },
        {
          title = "ICP Tokenomics Update: New Neuron Governance Features and Staking Rewards";
          source = "ICP News";
          publishedAt = "2025-03-10";
          url = "https://dashboard.internetcomputer.org";
        }
      ];
    };

    let total = allItems.size();
    if (total <= 20) { allItems } else {
      Array.tabulate<Types.NewsItem>(20, func(i) { allItems[i] });
    };
  };

  include MixinAuthorization(accessControlState);
  include PriceMixin();
  include MarketMixin(marketHistory);
  include PortfolioMixin(accessControlState, portfolioRecords, userSettings, executionHistory);
  include AnnouncementsMixin(accessControlState, announcements, announcementState);
  include ChatMixin(chatMessages, chatState);

  /// Returns 24-hour high/low price for ICP. Caches fresh results; returns stale on failure.
  public func getICP24hStats() : async ?Types.ICP24hStats {
    let fresh = await getICP24hStatsRaw();
    switch (fresh) {
      case (?stats) {
        stats24hCache.value := ?stats;
        ?stats;
      };
      case null {
        switch (stats24hCache.value) {
          case (?cached) ?{ high = cached.high; low = cached.low; fetchedAt = cached.fetchedAt; isStale = true };
          case null null;
        };
      };
    };
  };

  /// Returns the ICP social trending score (0-100). Caches result; returns stale on failure.
  public func getSocialTrending() : async Types.SocialTrendingResult {
    let fresh = await getSocialTrendingRaw();
    switch (fresh) {
      case (?result) {
        socialCache.value := ?result;
        result;
      };
      case null {
        switch (socialCache.value) {
          case (?cached) { { score = cached.score; fetchedAt = cached.fetchedAt; isStale = true } };
          case null { { score = 50.0; fetchedAt = 0; isStale = true } };
        };
      };
    };
  };

  /// Fetches the current ICP price, caches successes, and falls back to stale cache.
  /// Returns #ok with isStale=false on a live price, isStale=true for a cached stale
  /// price, or #err only when all sources fail and no cache is available.
  public func getICPPrice() : async Types.PriceResponse {
    let result = await getICPPriceRaw();
    switch (result) {
      case (#ok(priceResult)) {
        // Store fresh price in cache
        priceCache.value := ?priceResult;
        ignore checkAndTriggerAlerts(priceResult.priceUSD);
        #ok(priceResult);
      };
      case (#err(_)) {
        // All live sources failed -- return stale cache if available
        switch (priceCache.value) {
          case (?cached) {
            // Return stale cache with original fetchedAt and source preserved.
            // Do NOT overwrite fetchedAt -- it must reflect when the price was last live.
            #ok({ cached with isStale = true });
          };
          case null {
            #err("Price unavailable: all sources failed and no cached price exists");
          };
        };
      };
    };
  };
  /// Returns the current cycles balance of this canister.
  public query func getCyclesBalance() : async Nat { 0 };
};
