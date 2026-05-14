module {
  /// Result of a successful ICP price fetch.
  /// isStale = true means the value came from cache because all live sources failed.
  public type PriceResult = {
    priceUSD : Float;
    fetchedAt : Int; // nanoseconds since epoch (Time.now())
    isStale : Bool;  // true when served from cache, false for a fresh fetch
    source : Text;   // "CoinGecko" | "Binance" | "Coinbase" | "cached"
  };

  /// All possible outcomes when fetching the ICP price
  public type PriceResponse = {
    #ok : PriceResult;
    #err : Text;
  };

  /// One historical data point (price + volume + fear/greed)
  public type MarketDataPoint = {
    timestamp : Int; // nanoseconds
    priceUSD : Float;
    volume24h : Float;
    fearGreedScore : Nat;
  };

  /// Price + volume point (no fear/greed)
  public type PriceVolumePoint = {
    timestamp : Int; // nanoseconds
    priceUSD : Float;
    volume24h : Float;
  };

  /// Result of a successful fear & greed fetch
  public type FearGreedResult = {
    score : Nat;
    labelText : Text;
    fetchedAt : Int; // nanoseconds
  };

  /// All possible outcomes when fetching fear & greed
  public type FearGreedResponse = {
    #ok : FearGreedResult;
    #err : Text;
  };

  /// A price target entry in the exit strategy plan
  public type PriceTarget = {
    id : Text;
    targetPrice : Float;
    tokensToSell : Float;
    icpAmount : Float;
    notifyEmail : ?Text;  // legacy: per-row custom email override
    notifyViaEmail : Bool; // use the user's stored email for alerts
    notifyViaPhone : Bool; // use the user's stored phone for alerts (sends email)
    triggered : Bool;
  };

  /// Per-user contact settings for notifications
  public type UserSettings = {
    email : ?Text;
    phone : ?Text;
    theme : ?Text;         // "dark" | "light"; null treated as "dark"
    baseCurrency : ?Text;  // ISO 4217 code e.g. "USD", "EUR"; null treated as "USD"
    language : ?Text;      // BCP-47 language code e.g. "en", "es"; null treated as "en"
    notifyEmail : ?Bool;   // true = send email alerts on price target hit
    notifyPhone : ?Bool;   // reserved; always treated as false (no SMS on platform)
  };

  /// A completed exit strategy execution record
  public type ExecutionRecord = {
    id : Text;          // unique timestamp-based ID
    targetPrice : Float;
    tokensSold : Float;
    saleValue : Float;
    executedAt : Int;   // nanoseconds
    remainingICP : Float;
  };

  /// Per-user portfolio data (ICP amount + invested USD amount)
  public type PortfolioData = {
    icpAmount : Float;
    investedAmount : Float;
  };

  /// Unified per-user portfolio record — ICP amount, invested amount, and exit strategy targets
  public type PortfolioRecord = {
    icpAmount : Float;
    investedAmount : Float;
    priceTargets : [PriceTarget];
  };

  /// 24-hour high/low price result from Binance
  public type ICP24hStats = {
    high : Float;
    low : Float;
    fetchedAt : Int;  // nanoseconds since epoch
    isStale : Bool;
  };

  /// Social trending sentiment score for ICP
  public type SocialTrendingResult = {
    score : Float;   // 0–100 normalized composite score
    fetchedAt : Int; // nanoseconds since epoch
    isStale : Bool;
  };

  /// A single news article item
  public type NewsItem = {
    title : Text;
    source : Text;
    publishedAt : Text;
    url : Text;
  };
  /// Announcement category
  public type AnnouncementType = {
    #system_notice;
    #market_tip;
    #general;
  };

  /// An admin-authored announcement pushed to all users
  public type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    announcementType : AnnouncementType;
    isPublished : Bool;
    createdAt : Int;
    updatedAt : Int;
  };
  /// Rich link preview data extracted from a URL posted in chat.
  public type UrlPreview = {
    url : Text;
    title : Text;
    description : Text;
    thumbnailUrl : Text;
  };

  /// A single message in the ICP Community Chat.
  public type ChatMessage = {
    id : Nat;
    authorPrincipal : Principal;
    authorName : Text;
    content : Text;
    imageKey : ?Text;         // object-storage key; frontend uploads the file and passes the key
    likes : [Principal];
    dislikes : [Principal];
    shills : [Principal];     // users who marked this message as Shill
    fuds : [Principal];       // users who marked this message as FUD
    replyToId : ?Nat;
    timestamp : Int;          // nanoseconds (Time.now())
    isDeleted : Bool;
    tab : Text;               // computed: "shills" | "fud" | "icp" — derived from reaction counts
    urlPreview : ?UrlPreview; // optional rich link preview (YouTube thumbnail, etc.)
  };
};
