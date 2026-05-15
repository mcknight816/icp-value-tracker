import Types "../types/price";
import PriceLib "../lib/price";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Debug "mo:core/Debug";
import Error "mo:core/Error";

/// Mixin that exposes the public ICP price, 24h stats, social trending, and news endpoints.
mixin () {
  /// Transform callback for ICP price HTTP responses (strips non-deterministic headers).
  public query func transformPrice(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for Binance API price HTTP responses.
  public shared query func transformPriceBinance(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for Coinbase API price HTTP responses.
  public shared query func transformPriceCoinbase(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for Binance 24h ticker HTTP responses.
  public query func transformBinance24h(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for CryptoCompare social stats HTTP responses.
  public query func transformSocialStats(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for news feed HTTP responses.
  public query func transformNewsItems(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for DFINITY Blog Medium RSS HTTP responses.
  public query func transformDfinityBlog(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for Decrypt RSS HTTP responses.
  public query func transformDecryptRss(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Fetches the current ICP/USD price (raw, no alert side-effects).
  /// Tries CoinGecko → Binance → Coinbase in order; returns #err if all fail.
  public func getICPPriceRaw() : async Types.PriceResponse {
    let cgUrl = "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd";
    let binanceUrl = "https://api.binance.com/api/v3/ticker/price?symbol=ICPUSDT";
    let coinbaseUrl = "https://api.coinbase.com/v2/prices/ICP-USD/spot";

    // Try CoinGecko first
    let cgResult : Types.PriceResponse = try {
      let body = await OutCall.httpGetRequest(cgUrl, [], transformPrice);
      PriceLib.parsePrice(body);
    } catch (_e) {
      #err("CoinGecko HTTP outcall failed");
    };

    switch (cgResult) {
      case (#ok(result)) { return #ok(result) };
      case (#err(_)) {};
    };

    // Fall back to Binance
    let binanceResult : Types.PriceResponse = try {
      let body = await OutCall.httpGetRequest(binanceUrl, [], transformPriceBinance);
      PriceLib.parsePriceBinance(body);
    } catch (_e) {
      #err("Binance HTTP outcall failed");
    };

    switch (binanceResult) {
      case (#ok(result)) { return #ok(result) };
      case (#err(_)) {};
    };

    // Final fallback: Coinbase
    let coinbaseResult : Types.PriceResponse = try {
      let body = await OutCall.httpGetRequest(coinbaseUrl, [], transformPriceCoinbase);
      PriceLib.parsePriceCoinbase(body);
    } catch (_e) {
      #err("Coinbase HTTP outcall failed");
    };

    switch (coinbaseResult) {
      case (#ok(result)) { #ok(result) };
      case (#err(_)) {
        #err("Price unavailable: CoinGecko, Binance, and Coinbase all failed");
      };
    };
  };

  /// Fetches 24-hour high/low price for ICP from Binance (raw, no caching).
  func getICP24hStatsRaw() : async ?Types.ICP24hStats {
    let url = "https://api.binance.com/api/v3/ticker/24hr?symbol=ICPUSDT";
    let body = try {
      await OutCall.httpGetRequest(url, [], transformBinance24h);
    } catch (_e) {
      return null;
    };
    switch (PriceLib.parse24hStats(body)) {
      case (?(high, low)) {
        ?{ high; low; fetchedAt = Time.now(); isStale = false };
      };
      case null null;
    };
  };

  /// Fetches the ICP social trending score from CryptoCompare (raw, no caching).
  func getSocialTrendingRaw() : async ?Types.SocialTrendingResult {
    let url = "https://min-api.cryptocompare.com/data/social/coin/latest?coinId=6536";
    let body = try {
      await OutCall.httpGetRequest(url, [], transformSocialStats);
    } catch (_e) {
      return null;
    };
    switch (PriceLib.parseSocialScore(body)) {
      case (?score) {
        ?{ score; fetchedAt = Time.now(); isStale = false };
      };
      case null null;
    };
  };

  /// Transform callback for CoinTelegraph RSS HTTP responses.
  public query func transformCoinTelegraphRss(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for CoinDesk RSS HTTP responses.
  public query func transformCoinDeskRss(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Returns true if the given text contains an ICP-related keyword.
  func containsICPKeyword(text : Text) : Bool {
    let lower = text.toLower();
    lower.contains(#text "icp") or
    lower.contains(#text "internet computer") or
    lower.contains(#text "dfinity") or
    lower.contains(#text "canister") or
    lower.contains(#text "nns") or
    lower.contains(#text "sns") or
    lower.contains(#text "chain fusion");
  };

  /// Fetches ICP-filtered news items from CoinDesk RSS. Returns [] on failure.
  public func fetchCoinDeskItems() : async [Types.NewsItem] {
    let url = "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml";
    let headers = [
      {name="Accept"; value="application/rss+xml, application/xml, text/xml, */*"},
      {name="User-Agent"; value="ICP-Pulse/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformCoinDeskRss);
      Debug.print("[news] CoinDesk RSS body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] CoinDesk RSS response too small, skipping");
        return [];
      };
      let all = PriceLib.parseRssItems(body, "CoinDesk", 50);
      let filtered = all.filter(func(item : Types.NewsItem) : Bool { containsICPKeyword(item.title) or containsICPKeyword(item.source) });
      Debug.print("[news] CoinDesk parsed ICP items: " # debug_show(filtered.size()));
      if (filtered.size() <= 8) filtered else Array.tabulate<Types.NewsItem>(8, func i = filtered[i]);
    } catch (e) {
      Debug.print("[news] CoinDesk RSS fetch failed: " # e.message());
      [];
    };
  };

  /// Fetches news items from DFINITY Blog (Medium RSS). Returns [] on failure.
  /// Fetches news items from DFINITY Blog (Medium RSS). Returns [] on failure.
  /// Fetches news items from CoinGecko ICP news RSS. Returns [] on failure.
  /// Fetches news items from DFINITY Forum latest announcements JSON API. Returns [] on failure.
  /// Fetches news items from DFINITY Medium RSS feed. Returns [] on failure.
  public func fetchDfinityBlogItems() : async [Types.NewsItem] {
    let url = "https://medium.com/feed/dfinity";
    let headers = [
      {name="Accept"; value="application/rss+xml, application/xml, text/xml, */*"},
      {name="User-Agent"; value="ICP-Pulse/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformDfinityBlog);
      Debug.print("[news] DFINITY Medium RSS body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] DFINITY Medium response too small, skipping");
        return [];
      };
      let parsed = PriceLib.parseRssItems(body, "DFINITY", 8);
      Debug.print("[news] DFINITY Medium parsed items: " # debug_show(parsed.size()));
      parsed;
    } catch (e) {
      Debug.print("[news] DFINITY Medium fetch failed: " # e.message());
      [];
    };
  };

  /// Fetches news items from CoinTelegraph ICP tag RSS. Returns [] on failure.
  /// Fetches news items from CoinTelegraph ICP tag RSS. Returns [] on failure.
  /// Fetches ICP-filtered news items from CoinTelegraph main RSS. Returns [] on failure.
  /// Fetches ICP-relevant news items from CoinGecko News JSON API. Returns [] on failure.
  /// Fetches ICP-filtered news items from CoinTelegraph RSS. Returns [] on failure.
  public func fetchCoinTelegraphItems() : async [Types.NewsItem] {
    let url = "https://cointelegraph.com/rss";
    let headers = [
      {name="Accept"; value="application/rss+xml, application/xml, text/xml, */*"},
      {name="User-Agent"; value="ICP-Pulse/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformCoinTelegraphRss);
      Debug.print("[news] CoinTelegraph RSS body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] CoinTelegraph RSS response too small, skipping");
        return [];
      };
      // Parse all items then filter for ICP relevance
      let all = PriceLib.parseRssItems(body, "CoinTelegraph", 50);
      let filtered = all.filter(func(item : Types.NewsItem) : Bool { containsICPKeyword(item.title) or containsICPKeyword(item.source) });
      Debug.print("[news] CoinTelegraph parsed ICP items: " # debug_show(filtered.size()));
      if (filtered.size() <= 8) filtered else Array.tabulate<Types.NewsItem>(8, func i = filtered[i]);
    } catch (e) {
      Debug.print("[news] CoinTelegraph RSS fetch failed: " # e.message());
      [];
    };
  };

  /// Fetches ICP-filtered news items from Decrypt RSS. Returns [] on failure.
  /// Fetches ICP-filtered news items from Decrypt RSS. Returns [] on failure.
  /// Fetches ICP-specific news from CryptoPanic RSS. Returns [] on failure.
  /// Fetches news items from DFINITY Forum general latest topics JSON API. Returns [] on failure.
  /// Fetches ICP-filtered news items from Decrypt RSS. Returns [] on failure.
  public func fetchDecryptItems() : async [Types.NewsItem] {
    let url = "https://decrypt.co/feed";
    let headers = [
      {name="Accept"; value="application/rss+xml, application/xml, text/xml, */*"},
      {name="User-Agent"; value="ICP-Pulse/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformDecryptRss);
      Debug.print("[news] Decrypt RSS body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] Decrypt RSS response too small, skipping");
        return [];
      };
      let all = PriceLib.parseRssItems(body, "Decrypt", 50);
      let filtered = all.filter(func(item : Types.NewsItem) : Bool { containsICPKeyword(item.title) or containsICPKeyword(item.source) });
      Debug.print("[news] Decrypt parsed ICP items: " # debug_show(filtered.size()));
      if (filtered.size() <= 8) filtered else Array.tabulate<Types.NewsItem>(8, func i = filtered[i]);
    } catch (e) {
      Debug.print("[news] Decrypt RSS fetch failed: " # e.message());
      [];
    };
  };

  /// Fetches recent ICP news articles from all three feeds independently.
  /// Returns a merged list capped at 20 items.
  /// Fetches recent ICP news articles from all three feeds IN PARALLEL.
  /// Fires all three HTTP outcalls concurrently so one slow/failing feed
  /// cannot block the others. Returns merged list capped at 20 items.
  /// Fetches recent ICP news articles from all three feeds IN PARALLEL.
  /// Fires all three HTTP outcalls concurrently so one slow/failing feed
  /// cannot block the others. Returns merged list capped at 20 items.
  /// Falls back to a placeholder article if all feeds return empty.
  /// Fetches recent ICP news articles from all four RSS feeds IN PARALLEL.
  /// Fires all four HTTP outcalls concurrently so one slow/failing feed
  /// cannot block the others. Returns merged list capped at 20 items.
  public func getICPNewsRaw() : async [Types.NewsItem] {
    // Fire all four outcalls concurrently — store the futures BEFORE awaiting.
    let dfinityFuture   = fetchDfinityBlogItems();
    let ctFuture        = fetchCoinTelegraphItems();
    let decryptFuture   = fetchDecryptItems();
    let coinDeskFuture  = fetchCoinDeskItems();

    let dfinityItems  = await dfinityFuture;
    let ctItems       = await ctFuture;
    let decryptItems  = await decryptFuture;
    let coinDeskItems = await coinDeskFuture;

    Debug.print("[news] feed sizes — DFINITY:" # debug_show(dfinityItems.size()) # " CT:" # debug_show(ctItems.size()) # " Decrypt:" # debug_show(decryptItems.size()) # " CoinDesk:" # debug_show(coinDeskItems.size()));

    let allItems = dfinityItems.concat(ctItems).concat(decryptItems).concat(coinDeskItems);

    if (allItems.size() == 0) {
      Debug.print("[news] All feeds returned empty — using fallback placeholder");
      return [{
        title = "Latest ICP & DFINITY News — dfinity.org/news";
        source = "DFINITY";
        publishedAt = "";
        url = "https://dfinity.org/news";
      }];
    };

    let total = allItems.size();
    if (total <= 20) { allItems } else { Array.tabulate<Types.NewsItem>(20, func i = allItems[i]) };
  };
};
