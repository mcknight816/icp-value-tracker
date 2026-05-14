import Types "../types/price";
import PriceLib "../lib/price";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import List "mo:core/List";
import Time "mo:core/Time";

/// Mixin that exposes market chart, volume, and fear & greed data.
/// Receives the actor's two transform query functions so the IC can
/// strip non-deterministic HTTP headers from each type of response.
mixin (
  marketHistory : List.List<Types.MarketDataPoint>,
) {
  /// Maps a fear & greed score to a human-readable label.
  func fearGreedLabel(score : Nat) : Text {
    if (score <= 24) "Extreme Fear"
    else if (score <= 44) "Fear"
    else if (score <= 55) "Neutral"
    else if (score <= 74) "Greed"
    else "Extreme Greed";
  };
  /// Fetches 30-day market chart from CoinGecko and fear & greed from alternative.me,
  /// merges the results, and appends distinct entries into marketHistory.
  public func fetchAndStoreMarketData() : async () {
    let chartUrl = "https://api.coingecko.com/api/v3/coins/internet-computer/market_chart?vs_currency=usd&days=30&interval=daily";
    let fngUrl = "https://api.alternative.me/fng/?limit=30&format=json";

    // Fetch both in sequence (IC does not support true parallel awaits in a single update)
    let chartBody = try {
      await OutCall.httpGetRequest(chartUrl, [], transformMarketChart);
    } catch (_e) {
      "";
    };

    let fngBody = try {
      await OutCall.httpGetRequest(fngUrl, [], transformFearGreed);
    } catch (_e) {
      "";
    };

    // Parse market chart
    let chartPoints : [(Int, Float, Float)] = switch (PriceLib.parseMarketChart(chartBody)) {
      case null [];
      case (?pts) pts;
    };

    // Parse fear & greed (most recent score used for all points)
    let fngEntry = PriceLib.parseFearGreed(fngBody);

    let nowNs : Int = Time.now();
    let dayNs : Int = 86_400_000_000_000;

    for ((tsNs, price, vol) in chartPoints.values()) {
      let score = fngEntry.score;

      let point : Types.MarketDataPoint = {
        timestamp = tsNs;
        priceUSD = price;
        volume24h = vol;
        fearGreedScore = score;
      };

      // Only add if not already stored (deduplicate by timestamp)
      let exists = marketHistory.find(func(p : Types.MarketDataPoint) : Bool { p.timestamp == tsNs });
      switch (exists) {
        case null { marketHistory.add(point) };
        case (?_) {};
      };
    };
  };

  /// Returns all stored market history points.
  public query func getMarketHistory() : async [Types.MarketDataPoint] {
    marketHistory.toArray();
  };

  /// Returns the most recent fear & greed result from stored history,
  /// or null if no data has been fetched yet.
  public query func getCurrentFearGreed() : async ?Types.FearGreedResult {
    var best : ?Types.MarketDataPoint = null;
    for (p in marketHistory.values()) {
      switch (best) {
        case null { best := ?p };
        case (?b) {
          if (p.timestamp > b.timestamp) { best := ?p };
        };
      };
    };
    switch (best) {
      case null null;
      case (?p) {
        ?{
          score = p.fearGreedScore;
          labelText = fearGreedLabel(p.fearGreedScore);
          fetchedAt = p.timestamp;
        };
      };
    };
  };

  /// Returns history filtered to the last `days` days.
  public query func getMarketChart(days : Nat) : async [Types.PriceVolumePoint] {
    let nowNs : Int = Time.now();
    let cutoff : Int = nowNs - (days.toInt() * 86_400_000_000_000);
    let filtered = marketHistory.filter(func(p : Types.MarketDataPoint) : Bool { p.timestamp >= cutoff });
    filtered.map<Types.MarketDataPoint, Types.PriceVolumePoint>(func(p) {
      { timestamp = p.timestamp; priceUSD = p.priceUSD; volume24h = p.volume24h };
    }).toArray();
  };

  /// Transform callback for market chart HTTP responses (strips non-deterministic headers).
  public query func transformMarketChart(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Transform callback for fear & greed HTTP responses.
  public query func transformFearGreed(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };
};
