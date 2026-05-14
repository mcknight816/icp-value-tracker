import Types "../types/price";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Float "mo:core/Float";

module {
  /// Parses a float from a decimal string like "8.5" or "12.34" or "1e2".
  /// Returns null on any parse failure.
  func parseFloat(s : Text) : ?Float {
    // Handle leading minus
    let (neg, digits) = if (s.startsWith(#char '-')) {
      (true, switch (s.stripStart(#char '-')) { case (?t) t; case null "" })
    } else {
      (false, s)
    };
    if (digits == "") return null;

    // Split on 'e'/'E' for scientific notation
    let (mantissa, exp) : (Text, Int) = switch (digits.split(#char 'e').next()) {
      case null (digits, 0);
      case (?m) {
        let rest = switch (digits.split(#char 'e')) {
          case iter {
            ignore iter.next();
            switch (iter.next()) { case (?e) e; case null "" };
          };
        };
        let expVal : ?Int = if (rest == "") ?0 else Int.fromText(rest);
        switch (expVal) { case (?e) (m, e); case null return null };
      };
    };
    // Handle 'E' too
    let (mantissa2, exp2) : (Text, Int) = if (exp == 0) {
      switch (mantissa.split(#char 'E').next()) {
        case null (mantissa, 0);
        case (?m) {
          let rest2 = switch (mantissa.split(#char 'E')) {
            case iter {
              ignore iter.next();
              switch (iter.next()) { case (?e) e; case null "" };
            };
          };
          let expVal2 : ?Int = if (rest2 == "") ?0 else Int.fromText(rest2);
          switch (expVal2) { case (?e) (m, e); case null return null };
        };
      }
    } else { (mantissa, exp) };

    // Split mantissa on '.'
    let (intPart, fracPart) : (Text, Text) = switch (mantissa2.split(#char '.').next()) {
      case null (mantissa2, "");
      case (?i) {
        let frac = switch (mantissa2.split(#char '.')) {
          case iter {
            ignore iter.next();
            switch (iter.next()) { case (?f) f; case null "" };
          };
        };
        (i, frac);
      };
    };

    // Parse integer part
    let intVal : ?Nat = if (intPart == "") ?0 else Nat.fromText(intPart);
    let intN : Nat = switch (intVal) { case (?n) n; case null return null };

    // Parse fractional part
    let fracLen = fracPart.size();
    let fracVal : ?Nat = if (fracPart == "") ?0 else Nat.fromText(fracPart);
    let fracN : Nat = switch (fracVal) { case (?n) n; case null return null };

    // Combine: value = intN + fracN / 10^fracLen
    var divisor : Float = 1.0;
    var i = 0;
    while (i < fracLen) { divisor := divisor * 10.0; i += 1 };
    var result : Float = intN.toFloat() + (fracN.toFloat() / divisor);

    // Apply scientific notation exponent
    if (exp2 != 0) {
      var factor : Float = 1.0;
      if (exp2 > 0) {
        var j = 0;
        while (j < exp2) { factor := factor * 10.0; j += 1 };
        result := result * factor;
      } else {
        var j = 0;
        let negExp = Int.abs(exp2);
        while (j < negExp) { factor := factor * 10.0; j += 1 };
        result := result / factor;
      };
    };

    if (neg) { ?(-result) } else { ?result };
  };

  /// Parses DFINITY forum /latest.json and returns up to `limit` NewsItems.
  /// Forum JSON shape: {"topic_list":{"topics":[{"title":"","slug":"","created_at":"","excerpt":""},...]}}
  public func parseForumTopics(json : Text, sourceName : Text, limit : Nat) : [Types.NewsItem] {
    // Extract the array after "topics":
    let marker = "\"topics\"";
    let parts = json.split(#text marker);
    ignore parts.next();
    let afterTopics : Text = switch (parts.next()) {
      case null { return [] };
      case (?t) t;
    };
    // Find the opening '['
    let bracketParts = afterTopics.split(#char '[');
    ignore bracketParts.next();
    let topicsArr : Text = switch (bracketParts.next()) {
      case null { return [] };
      case (?arr) "[" # arr; // put back the '['
    };

    // Split on "},{" to get individual topic objects
    let objParts = topicsArr.split(#text "},{");
    var items : [Types.NewsItem] = [];
    var count = 0;
    for (part in objParts) {
      if (count < limit) {
        // extract "title":
        let titleMarker = "\"title\":\"";
        let titleParts = part.split(#text titleMarker);
        ignore titleParts.next();
        let title : Text = switch (titleParts.next()) {
          case null "";
          case (?after) {
            var t = "";
            var done = false;
            for (c in after.chars()) {
              if (not done) {
                if (c == '\"') { done := true }
                else { t := t # Text.fromChar(c) };
              };
            };
            t;
          };
        };
        // extract "slug":
        let slugMarker = "\"slug\":\"";
        let slugParts = part.split(#text slugMarker);
        ignore slugParts.next();
        let slug : Text = switch (slugParts.next()) {
          case null "";
          case (?after) {
            var s = "";
            var done = false;
            for (c in after.chars()) {
              if (not done) {
                if (c == '\"') { done := true }
                else { s := s # Text.fromChar(c) };
              };
            };
            s;
          };
        };
        // extract "created_at":
        let dateMarker = "\"created_at\":\"";
        let dateParts = part.split(#text dateMarker);
        ignore dateParts.next();
        let createdAt : Text = switch (dateParts.next()) {
          case null "";
          case (?after) {
            var d = "";
            var done = false;
            for (c in after.chars()) {
              if (not done) {
                if (c == '\"') { done := true }
                else { d := d # Text.fromChar(c) };
              };
            };
            d;
          };
        };
        if (title != "" and slug != "") {
          let url = "https://forum.dfinity.org/t/" # slug;
          items := items.concat([{ title; source = sourceName; publishedAt = createdAt; url }]);
          count += 1;
        };
      };
    };
    items;
  };

  /// Parses CoinGecko /api/v3/news JSON and returns ICP-relevant NewsItems (up to `limit`).
  /// JSON shape: {"data":[{"title":"","description":"","url":"","updated_at":0,"news_site":""},...],"count":N}
  public func parseCoinGeckoNews(json : Text, limit : Nat) : [Types.NewsItem] {
    let dataMarker = "\"data\"";
    let parts = json.split(#text dataMarker);
    ignore parts.next();
    let afterData : Text = switch (parts.next()) {
      case null { return [] };
      case (?t) t;
    };
    // Find opening '['
    let bracketParts = afterData.split(#char '[');
    ignore bracketParts.next();
    let dataArr : Text = switch (bracketParts.next()) {
      case null { return [] };
      case (?arr) "[" # arr;
    };

    func extractStr(src : Text, key : Text) : Text {
      let marker = "\"" # key # "\":\"";
      let kparts = src.split(#text marker);
      ignore kparts.next();
      switch (kparts.next()) {
        case null "";
        case (?after) {
          var t = "";
          var done = false;
          for (c in after.chars()) {
            if (not done) {
              if (c == '\"') { done := true }
              else { t := t # Text.fromChar(c) };
            };
          };
          t;
        };
      };
    };

    let objParts = dataArr.split(#text "},{");
    var items : [Types.NewsItem] = [];
    var count = 0;
    for (part in objParts) {
      if (count < limit) {
        let title = extractStr(part, "title");
        let url = extractStr(part, "url");
        let newsSite = extractStr(part, "news_site");
        let description = extractStr(part, "description");
        // Filter for ICP-relevant articles
        let relevant = containsICPKeyword(title) or containsICPKeyword(description) or
                       containsICPKeyword(newsSite);
        if (relevant and title != "" and url != "") {
          items := items.concat([{ title; source = newsSite; publishedAt = ""; url }]);
          count += 1;
        };
      };
    };
    items;
  };

  /// Parses an ICP/USD price from a raw CoinGecko JSON response.
  /// Expected shape: {"internet-computer":{"usd":8.5}}
  /// Extracts the numeric value after the last "usd": token.
  public func parsePrice(json : Text) : Types.PriceResponse {
    let marker = "\"usd\"";
    switch (json.split(#text marker).next()) {
      case null { #err("usd marker not found in response") };
      case (?_prefix) {
        // After the marker we expect :NUMBER
        let rest = switch (json.split(#text marker)) {
          case iter {
            ignore iter.next(); // skip prefix
            switch (iter.next()) {
              case (?after) after;
              case null { return #err("malformed JSON: nothing after usd key") };
            };
          };
        };
        // rest starts with ":" then optional spaces then the number
        var s = rest.trimStart(#char ':');
        s := s.trimStart(#char ' ');
        // collect digits, '.', '-', 'e', 'E', '+'
        var numChars = "";
        var done = false;
        for (c in s.chars()) {
          if (not done) {
            if (c == '-' or c == '+' or c == '.' or
                (c >= '0' and c <= '9') or c == 'e' or c == 'E') {
              numChars := numChars # Text.fromChar(c);
            } else {
              done := true;
            };
          };
        };
        if (numChars == "") {
          return #err("could not extract numeric price from: " # rest);
        };
        switch (parseFloat(numChars)) {
          case null { #err("failed to parse float: " # numChars) };
          case (?price) {
            #ok({ priceUSD = price; fetchedAt = Time.now(); isStale = false; source = "CoinGecko" });
          };
        };
      };
    };
  };

  /// Parses an ICP/USD price from a Binance API JSON response.
  /// Expected shape: {"symbol":"ICPUSDT","price":"8.1234"}
  /// Extracts the numeric value after the "price":"VALUE" pattern.
  public func parsePriceBinance(json : Text) : Types.PriceResponse {
    let marker = "\"price\":\"";
    switch (json.split(#text marker).next()) {
      case null { #err("price marker not found in Binance response") };
      case (?_prefix) {
        let rest = switch (json.split(#text marker)) {
          case iter {
            ignore iter.next();
            switch (iter.next()) {
              case (?after) after;
              case null { return #err("malformed Binance JSON: nothing after price key") };
            };
          };
        };
        // rest starts with the number then closing quote
        var numChars = "";
        var done = false;
        for (c in rest.chars()) {
          if (not done) {
            if (c == '\u{22}') {
              done := true;
            } else if (c == '-' or c == '+' or c == '.' or
                (c >= '0' and c <= '9') or c == 'e' or c == 'E') {
              numChars := numChars # Text.fromChar(c);
            } else {
              done := true;
            };
          };
        };
        if (numChars == "") {
          return #err("could not extract numeric price from Binance response: " # rest);
        };
        switch (parseFloat(numChars)) {
          case null { #err("failed to parse float from Binance: " # numChars) };
          case (?price) {
            #ok({ priceUSD = price; fetchedAt = Time.now(); isStale = false; source = "Binance" });
          };
        };
      };
    };
  };

  /// Parses an ICP/USD price from a Coinbase API JSON response.
  /// Expected shape: {"data":{"base":"ICP","currency":"USD","amount":"12.34"}}
  /// Extracts the numeric value from the "amount" field inside "data".
  public func parsePriceCoinbase(json : Text) : Types.PriceResponse {
    let marker = "\"amount\":\"";
    switch (json.split(#text marker).next()) {
      case null { #err("amount marker not found in Coinbase response") };
      case (?_prefix) {
        let rest = switch (json.split(#text marker)) {
          case iter {
            ignore iter.next();
            switch (iter.next()) {
              case (?after) after;
              case null { return #err("malformed Coinbase JSON: nothing after amount key") };
            };
          };
        };
        // rest starts with the number then closing quote
        var numChars = "";
        var done = false;
        for (c in rest.chars()) {
          if (not done) {
            if (c == '\u{22}') {
              done := true;
            } else if (c == '-' or c == '+' or c == '.' or
                (c >= '0' and c <= '9') or c == 'e' or c == 'E') {
              numChars := numChars # Text.fromChar(c);
            } else {
              done := true;
            };
          };
        };
        if (numChars == "") {
          return #err("could not extract numeric price from Coinbase response: " # rest);
        };
        switch (parseFloat(numChars)) {
          case null { #err("failed to parse float from Coinbase: " # numChars) };
          case (?price) {
            #ok({ priceUSD = price; fetchedAt = Time.now(); isStale = false; source = "Coinbase" });
          };
        };
      };
    };
  };

  /// Parses a CoinGecko market_chart JSON with "prices":[[ts_ms,price],...] and
  /// "total_volumes":[[ts_ms,vol],...] into an array of (timestamp_ns, priceUSD, volume).
  /// Returns null on any parse failure.
  public func parseMarketChart(json : Text) : ?[(Int, Float, Float)] {
    let pricesMarker = "\"prices\"";
    let volMarker = "\"total_volumes\"";

    func extractArray(marker : Text) : ?Text {
      let parts = json.split(#text marker);
      ignore parts.next();
      switch (parts.next()) {
        case null null;
        case (?after) {
          var s = after.trimStart(#char ':');
          s := s.trimStart(#char ' ');
          if (not s.startsWith(#char '[')) return null;
          var depth = 0;
          var result = "";
          var finished = false;
          for (c in s.chars()) {
            if (not finished) {
              result := result # Text.fromChar(c);
              if (c == '[') { depth += 1 }
              else if (c == ']') {
                depth -= 1;
                if (depth == 0) { finished := true };
              };
            };
          };
          ?result;
        };
      };
    };

    func parsePair(s : Text) : ?(Int, Float) {
      var t = s.trimStart(#char '[');
      t := t.trimEnd(#char ']');
      t := t.trim(#char ' ');
      let iter = t.split(#char ',');
      let tsText = switch (iter.next()) { case (?v) v; case null return null };
      let valText = switch (iter.next()) { case (?v) v; case null return null };
      let tsOpt = Int.fromText(tsText.trim(#char ' '));
      let valOpt = parseFloat(valText.trim(#char ' '));
      switch (tsOpt, valOpt) {
        case (?ts, ?v) ?(ts, v);
        case _ null;
      };
    };

    func splitPairs(arr : Text) : [Text] {
      var t = arr.trimStart(#char '[');
      t := t.trimEnd(#char ']');
      let parts = t.split(#text "],[");
      parts.toArray();
    };

    let pricesArr = switch (extractArray(pricesMarker)) { case null return null; case (?a) a };
    let volsArr = switch (extractArray(volMarker)) { case null return null; case (?a) a };

    let pricePairs = splitPairs(pricesArr);
    let volPairs = splitPairs(volsArr);

    let len = pricePairs.size();
    if (len == 0) return ?([] : [(Int, Float, Float)]);

    var results : [(Int, Float, Float)] = [];
    var idx = 0;
    while (idx < len) {
      let pOpt = parsePair(pricePairs[idx]);
      let vOpt = if (idx < volPairs.size()) parsePair(volPairs[idx]) else null;
      switch (pOpt) {
        case (?(ts, price)) {
          let vol = switch (vOpt) { case (?(_, v)) v; case null 0.0 };
          let tsNs : Int = ts * 1_000_000;
          results := results.concat([(tsNs, price, vol)]);
        };
        case null {};
      };
      idx += 1;
    };
    ?results;
  };

  /// Parses alternative.me Fear & Greed JSON.
  /// Expected shape: {"data":[{"value":"55","value_classification":"Greed","timestamp":"1234567890"},...]}
  /// Returns the most recent entry (index 0). On error returns a default.
  public func parseFearGreed(json : Text) : { score : Nat; labelText : Text; timestamp : Int } {
    let defaultVal = { score = 50; labelText = "Neutral"; timestamp = 0 };

    // Collect digit chars after ':' and optional opening '"'
    func extractDigits(src : Text) : Text {
      var s = src.trimStart(#char ':');
      s := s.trimStart(#char ' ');
      var seenOpen = false;
      var digits = "";
      var done = false;
      for (c in s.chars()) {
        if (not done) {
          if (not seenOpen) {
            if (c == '\u{22}') { seenOpen := true }
            else if (c >= '0' and c <= '9') {
              seenOpen := true;
              digits := digits # Text.fromChar(c);
            };
          } else {
            if (c >= '0' and c <= '9') { digits := digits # Text.fromChar(c) }
            else { done := true };
          };
        };
      };
      digits
    };

    // Collect text chars between opening and closing '"' after ':'
    func extractQuotedValue(src : Text) : Text {
      var s = src.trimStart(#char ':');
      s := s.trimStart(#char ' ');
      var seenOpen = false;
      var value = "";
      var done = false;
      for (c in s.chars()) {
        if (not done) {
          if (not seenOpen) {
            if (c == '\u{22}') { seenOpen := true };
          } else {
            if (c == '\u{22}') { done := true }
            else { value := value # Text.fromChar(c) };
          };
        };
      };
      value
    };

    let valueMarker = "\"value\"";
    let parts = json.split(#text valueMarker);
    ignore parts.next();
    let scoreText : Text = switch (parts.next()) {
      case null { return defaultVal };
      case (?after) { extractDigits(after) };
    };
    let score : Nat = switch (Nat.fromText(scoreText)) { case (?n) n; case null { return defaultVal } };

    let labelMarker = "\"value_classification\"";
    let lparts = json.split(#text labelMarker);
    ignore lparts.next();
    let labelText : Text = switch (lparts.next()) {
      case null "Neutral";
      case (?after) { extractQuotedValue(after) };
    };

    let tsMarker = "\"timestamp\"";
    let tparts = json.split(#text tsMarker);
    ignore tparts.next();
    let tsInt : Int = switch (tparts.next()) {
      case null 0;
      case (?after) {
        let d = extractDigits(after);
        switch (Int.fromText(d)) { case (?n) n; case null 0 };
      };
    };

    { score; labelText; timestamp = tsInt * 1_000_000_000 };
  };

  /// Parses Binance 24hr ticker JSON for ICP 24h high/low.
  /// Expected shape: {...,"highPrice":"9.12","lowPrice":"7.88",...}
  public func parse24hStats(json : Text) : ?(Float, Float) {
    func extractQuotedNum(src : Text, marker : Text) : ?Float {
      let parts = src.split(#text marker);
      ignore parts.next();
      switch (parts.next()) {
        case null null;
        case (?after) {
          var s = after.trimStart(#char ':');
          s := s.trimStart(#char ' ');
          // strip leading quote if present
          if (s.startsWith(#char '\u{22}')) {
            s := switch (s.stripStart(#char '\u{22}')) { case (?t) t; case null s };
          };
          var numChars = "";
          var done = false;
          for (c in s.chars()) {
            if (not done) {
              if (c == '\u{22}') {
                done := true;
              } else if (c == '-' or c == '+' or c == '.' or
                  (c >= '0' and c <= '9') or c == 'e' or c == 'E') {
                numChars := numChars # Text.fromChar(c);
              } else if (c != ' ') {
                done := true;
              };
            };
          };
          parseFloat(numChars);
        };
      };
    };
    let highOpt = extractQuotedNum(json, "\u{22}highPrice\u{22}:");
    let lowOpt = extractQuotedNum(json, "\u{22}lowPrice\u{22}:");
    switch (highOpt, lowOpt) {
      case (?h, ?l) ?(h, l);
      case _ null;
    };
  };

  /// Parses CryptoCompare social stats JSON for ICP.
  /// Extracts Reddit (posts_per_hour, comments_per_hour) and
  /// Twitter (statuses, followers) and normalises to 0-100.
  public func parseSocialScore(json : Text) : ?Float {
    func extractNum(src : Text, marker : Text) : Float {
      let parts = src.split(#text marker);
      ignore parts.next();
      switch (parts.next()) {
        case null 0.0;
        case (?after) {
          var s = after.trimStart(#char ':');
          s := s.trimStart(#char ' ');
          // strip opening quote if present
          if (s.startsWith(#char '\u{22}')) {
            s := switch (s.stripStart(#char '\u{22}')) { case (?t) t; case null s };
          };
          var numChars = "";
          var done = false;
          for (c in s.chars()) {
            if (not done) {
              if (c == '\u{22}' or c == ',' or c == '}') {
                done := true;
              } else if (c == '-' or c == '+' or c == '.' or
                  (c >= '0' and c <= '9') or c == 'e' or c == 'E') {
                numChars := numChars # Text.fromChar(c);
              } else if (c != ' ') {
                done := true;
              };
            };
          };
          switch (parseFloat(numChars)) { case (?v) v; case null 0.0 };
        };
      };
    };

    // Extract individual signals
    let postsPerHour = extractNum(json, "\"posts_per_hour\":");
    let commentsPerHour = extractNum(json, "\"comments_per_hour\":");
    let statuses = extractNum(json, "\"statuses\":");
    let followers = extractNum(json, "\"followers\":");

    // Weights: reddit activity 40%, twitter engagement 60%
    // Reddit: cap posts+comments at 50/hr combined = score 40
    let redditRaw = (postsPerHour + commentsPerHour) / 50.0 * 40.0;
    let redditScore = if (redditRaw > 40.0) 40.0 else if (redditRaw < 0.0) 0.0 else redditRaw;

    // Twitter: followers as baseline weight, statuses as activity
    // followers capped at 200_000 = 30pts, statuses capped at 5000/day = 30pts
    let followerScore = if (followers > 200_000.0) 30.0 else (followers / 200_000.0 * 30.0);
    let statusScore = if (statuses > 5_000.0) 30.0 else (statuses / 5_000.0 * 30.0);
    let twitterScore = followerScore + statusScore;

    let total = redditScore + twitterScore;
    let clamped = if (total > 100.0) 100.0 else if (total < 0.0) 0.0 else total;
    ?clamped;
  };

  /// Parses CryptoPanic free API posts JSON.
  /// Returns up to 15 NewsItem records.
  /// Parses CryptoPanic free API posts JSON.
  /// Returns up to 15 NewsItem records.
  /// Returns true if the given text contains an ICP-related keyword.
  /// Checks for "ICP", "Internet Computer", or "DFINITY" (case-insensitive).
  public func containsICPKeyword(text : Text) : Bool {
    let lower = text.toLower();
    lower.contains(#text "icp") or
    lower.contains(#text "internet computer") or
    lower.contains(#text "dfinity");
  };

  /// Parses a simple RSS/XML feed (CoinDesk or CoinTelegraph style).
  /// Extracts <item> blocks and returns up to `limit` NewsItems with the given sourceName.
  /// Parses a standard RSS/XML feed.
  /// Handles CDATA-wrapped fields, <link> and <guid> for URL, missing pubDate.
  /// Returns up to `limit` NewsItems with the given sourceName.
  /// Parses a standard RSS/XML feed, also handling Atom <entry> elements.
  /// Handles CDATA-wrapped fields, <link>, <guid>, <url> for URL, missing pubDate.
  /// Also handles <content:encoded> as fallback, and <entry> (Atom format).
  /// Returns up to `limit` NewsItems with the given sourceName.
  public func parseRssItems(xml : Text, sourceName : Text, limit : Nat) : [Types.NewsItem] {
    // Extract inner text between open and close tags, handling CDATA
    func extractTag(src : Text, open : Text, close : Text) : Text {
      let parts = src.split(#text open);
      ignore parts.next();
      switch (parts.next()) {
        case null "";
        case (?after) {
          let cparts = after.split(#text close);
          switch (cparts.next()) {
            case null "";
            case (?raw) {
              let t = raw.trim(#char ' ');
              // strip CDATA
              if (t.startsWith(#text "<![CDATA[")) {
                let stripped = switch (t.stripStart(#text "<![CDATA[")) { case (?x) x; case null t };
                switch (stripped.stripEnd(#text "]]>")) { case (?x) x.trim(#char ' '); case null stripped.trim(#char ' ') };
              } else { t };
            };
          };
        };
      };
    };

    // Parse a single block (item or entry) into a NewsItem or null
    func parseBlock(body : Text) : ?Types.NewsItem {
      let title = extractTag(body, "<title>", "</title>");

      // URL: prefer <link>, then <link href=...> (Atom), then <url>, then <guid>
      var url = extractTag(body, "<link>", "</link>");
      if (url == "") {
        // Atom: <link href="..."/>
        let linkHrefParts = body.split(#text "<link ");
        ignore linkHrefParts.next();
        switch (linkHrefParts.next()) {
          case null {};
          case (?linkTag) {
            let hrefParts = linkTag.split(#text "href=\"");
            ignore hrefParts.next();
            switch (hrefParts.next()) {
              case null {};
              case (?hrefRest) {
                let closeParts = hrefRest.split(#char '\"');
                url := switch (closeParts.next()) { case (?u) u.trim(#char ' '); case null "" };
              };
            };
          };
        };
      };
      if (url == "") {
        url := extractTag(body, "<url>", "</url>");
      };
      if (url == "") {
        // <guid> may have attributes: extract content between > and </guid>
        let guidRaw = extractTag(body, "<guid", "</guid>");
        if (guidRaw.startsWith(#char '>')) {
          url := switch (guidRaw.stripStart(#char '>')) { case (?u) u.trim(#char ' '); case null "" };
        } else {
          let gparts = guidRaw.split(#char '>');
          ignore gparts.next();
          url := switch (gparts.next()) { case (?u) u.trim(#char ' '); case null "" };
        };
      };

      // pubDate — fall back to dc:date, then <published> (Atom), then empty string
      var publishedAt = extractTag(body, "<pubDate>", "</pubDate>");
      if (publishedAt == "") {
        publishedAt := extractTag(body, "<dc:date>", "</dc:date>");
      };
      if (publishedAt == "") {
        publishedAt := extractTag(body, "<published>", "</published>");
      };
      if (publishedAt == "") {
        publishedAt := extractTag(body, "<updated>", "</updated>");
      };
      publishedAt := publishedAt.trim(#char ' ');
      url := url.trim(#char ' ');

      if (title != "" and url != "" and not url.startsWith(#char '<')) {
        ?{ title; source = sourceName; publishedAt; url };
      } else {
        null;
      };
    };

    var items : [Types.NewsItem] = [];
    var count = 0;

    // Try RSS <item> blocks first
    let itemParts = xml.split(#text "<item").toArray();
    var idx = 1; // skip feed header before first <item>
    while (idx < itemParts.size() and count < limit) {
      let part = itemParts[idx];
      // Drop tag attributes up to the first '>'
      let bodyParts = part.split(#char '>');
      ignore bodyParts.next();
      let body = switch (bodyParts.next()) { case (?b) b; case null part };
      switch (parseBlock(body)) {
        case (?item) { items := items.concat([item]); count += 1 };
        case null {};
      };
      idx += 1;
    };

    // If no <item> blocks found, try Atom <entry> blocks
    if (count == 0) {
      let entryParts = xml.split(#text "<entry").toArray();
      var eidx = 1;
      while (eidx < entryParts.size() and count < limit) {
        let part = entryParts[eidx];
        let bodyParts = part.split(#char '>');
        ignore bodyParts.next();
        let body = switch (bodyParts.next()) { case (?b) b; case null part };
        switch (parseBlock(body)) {
          case (?item) { items := items.concat([item]); count += 1 };
          case null {};
        };
        eidx += 1;
      };
    };

    items;
  };
};
