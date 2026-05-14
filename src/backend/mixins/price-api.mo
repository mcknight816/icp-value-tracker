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

  /// Fetches news items from DFINITY Blog (Medium RSS). Returns [] on failure.
  /// Fetches news items from DFINITY Blog (Medium RSS). Returns [] on failure.
  /// Fetches news items from CoinGecko ICP news RSS. Returns [] on failure.
  /// Fetches news items from DFINITY Forum latest announcements JSON API. Returns [] on failure.
  public func fetchDfinityBlogItems() : async [Types.NewsItem] {
    let url = "https://forum.dfinity.org/latest.json?category=9&per_page=20";
    let headers = [
      {name="Accept"; value="application/json"},
      {name="User-Agent"; value="ICP-Value-Tracker/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformDfinityBlog);
      Debug.print("[news] DFINITY Forum JSON body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] DFINITY Forum response too small, skipping");
        return [];
      };
      let items = PriceLib.parseForumTopics(body, "DFINITY Forum", 8);
      Debug.print("[news] DFINITY Forum parsed items: " # debug_show(items.size()));
      items;
    } catch (e) {
      Debug.print("[news] DFINITY Forum fetch failed: " # e.message());
      [];
    };
  };

  /// Fetches news items from CoinTelegraph ICP tag RSS. Returns [] on failure.
  /// Fetches news items from CoinTelegraph ICP tag RSS. Returns [] on failure.
  /// Fetches ICP-filtered news items from CoinTelegraph main RSS. Returns [] on failure.
  /// Fetches ICP-relevant news items from CoinGecko News JSON API. Returns [] on failure.
  public func fetchCoinTelegraphItems() : async [Types.NewsItem] {
    let url = "https://api.coingecko.com/api/v3/news?page=1";
    let headers = [
      {name="Accept"; value="application/json"},
      {name="User-Agent"; value="ICP-Value-Tracker/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformCoinTelegraphRss);
      Debug.print("[news] CoinGecko News JSON body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] CoinGecko News response too small, skipping");
        return [];
      };
      let items = PriceLib.parseCoinGeckoNews(body, 8);
      Debug.print("[news] CoinGecko News parsed ICP items: " # debug_show(items.size()));
      items;
    } catch (e) {
      Debug.print("[news] CoinGecko News fetch failed: " # e.message());
      [];
    };
  };

  /// Fetches ICP-filtered news items from Decrypt RSS. Returns [] on failure.
  /// Fetches ICP-filtered news items from Decrypt RSS. Returns [] on failure.
  /// Fetches ICP-specific news from CryptoPanic RSS. Returns [] on failure.
  /// Fetches news items from DFINITY Forum general latest topics JSON API. Returns [] on failure.
  public func fetchDecryptItems() : async [Types.NewsItem] {
    let url = "https://forum.dfinity.org/latest.json?per_page=20";
    let headers = [
      {name="Accept"; value="application/json"},
      {name="User-Agent"; value="ICP-Value-Tracker/1.0"}
    ];
    try {
      let body = await OutCall.httpGetRequest(url, headers, transformDecryptRss);
      Debug.print("[news] DFINITY Forum general JSON body size: " # debug_show(body.size()));
      if (body.size() < 10) {
        Debug.print("[news] DFINITY Forum general response too small, skipping");
        return [];
      };
      let items = PriceLib.parseForumTopics(body, "DFINITY Community", 8);
      Debug.print("[news] DFINITY Forum general parsed items: " # debug_show(items.size()));
      items;
    } catch (e) {
      Debug.print("[news] DFINITY Forum general fetch failed: " # e.message());
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
  public func getICPNewsRaw() : async [Types.NewsItem] {
    // Fire all three outcalls concurrently — store the futures BEFORE awaiting.
    let coinGeckoFuture = fetchDfinityBlogItems();
    let ctFuture = fetchCoinTelegraphItems();
    let cryptoPanicFuture = fetchDecryptItems();

    // Now await each result; all three HTTP calls are already in-flight.
    let coinGeckoItems = await coinGeckoFuture;
    let ctItems        = await ctFuture;
    let cryptoPanicItems = await cryptoPanicFuture;

    Debug.print("[news] feed sizes — CoinGecko:" # debug_show(coinGeckoItems.size()) # " CT:" # debug_show(ctItems.size()) # " CryptoPanic:" # debug_show(cryptoPanicItems.size()));

    let allItems = coinGeckoItems.concat(ctItems).concat(cryptoPanicItems);

    // If all feeds are empty, return a fallback placeholder so users always see something.
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
