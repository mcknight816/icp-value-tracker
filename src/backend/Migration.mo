import Map "mo:core/Map";
import Principal "mo:core/Principal";
import List "mo:core/List";

module {
  // ── Old types (from the previously deployed actor) ──────────────────────

  /// Old UserSettings matches the previously-deployed shape (already had notifyEmail/notifyPhone).
  type OldUserSettings = {
    email : ?Text;
    phone : ?Text;
    theme : ?Text;
    baseCurrency : ?Text;
    language : ?Text;
    notifyEmail : ?Bool;
    notifyPhone : ?Bool;
  };

  type OldPriceTarget = {
    id : Text;
    targetPrice : Float;
    tokensToSell : Float;
    icpAmount : Float;
    notifyEmail : ?Text;
    notifyViaEmail : Bool;
    notifyViaPhone : Bool;
    triggered : Bool;
  };

  type OldPortfolioRecord = {
    icpAmount : Float;
    investedAmount : Float;
    priceTargets : [OldPriceTarget];
  };

  /// Old ChatMessage — matches the previously-deployed snapshot exactly (no urlPreview field).
  type OldChatMessage = {
    id : Nat;
    authorPrincipal : Principal;
    authorName : Text;
    content : Text;
    imageKey : ?Text;
    likes : [Principal];
    dislikes : [Principal];
    shills : [Principal];
    fuds : [Principal];
    replyToId : ?Nat;
    timestamp : Int;
    isDeleted : Bool;
    tab : Text;
  };

  /// AnnouncementType/Announcement/ICP24hStats/SocialTrendingResult/NewsItem/PriceResult
  /// are all structurally identical in old and new — define inline for OldActor compatibility.
  type OldAnnouncementType = { #system_notice; #market_tip; #general };
  type OldAnnouncement = {
    id : Nat;
    title : Text;
    body : Text;
    announcementType : OldAnnouncementType;
    isPublished : Bool;
    createdAt : Int;
    updatedAt : Int;
  };
  type OldPriceResult = {
    priceUSD : Float;
    fetchedAt : Int;
    isStale : Bool;
    source : Text;
  };
  type OldICP24hStats = {
    high : Float;
    low : Float;
    fetchedAt : Int;
    isStale : Bool;
  };
  type OldSocialTrendingResult = {
    score : Float;
    fetchedAt : Int;
    isStale : Bool;
  };
  type OldNewsItem = {
    title : Text;
    source : Text;
    publishedAt : Text;
    url : Text;
  };
  type OldExecutionRecord = {
    id : Text;
    targetPrice : Float;
    tokensSold : Float;
    saleValue : Float;
    executedAt : Int;
    remainingICP : Float;
  };
  type OldMarketDataPoint = {
    timestamp : Int;
    priceUSD : Float;
    volume24h : Float;
    fearGreedScore : Nat;
  };

  type OldActor = {
    portfolioRecords : Map.Map<Principal, OldPortfolioRecord>;
    userSettings : Map.Map<Principal, OldUserSettings>;
    chatMessages : List.List<OldChatMessage>;
    chatState : { var nextId : Nat };
    marketHistory : List.List<OldMarketDataPoint>;
    executionHistory : Map.Map<Principal, [OldExecutionRecord]>;
    announcements : Map.Map<Nat, OldAnnouncement>;
    announcementState : { var nextId : Nat };
    priceCache : { var value : ?OldPriceResult };
    stats24hCache : { var value : ?OldICP24hStats };
    socialCache : { var value : ?OldSocialTrendingResult };
    newsCacheDfinity : { var items : [OldNewsItem]; var fetchedAt : Int };
    newsCacheCT : { var items : [OldNewsItem]; var fetchedAt : Int };
    newsCacheDecrypt : { var items : [OldNewsItem]; var fetchedAt : Int };
    donationAddressStore : { var value : Text };
  };

  // ── New types (matching the current actor shape) ─────────────────────────

  type PriceTarget = {
    id : Text;
    targetPrice : Float;
    tokensToSell : Float;
    icpAmount : Float;
    notifyEmail : ?Text;
    notifyViaEmail : Bool;
    notifyViaPhone : Bool;
    triggered : Bool;
  };

  type PortfolioRecord = {
    icpAmount : Float;
    investedAmount : Float;
    priceTargets : [PriceTarget];
  };

  type UserSettings = {
    email : ?Text;
    phone : ?Text;
    theme : ?Text;
    baseCurrency : ?Text;
    language : ?Text;
    notifyEmail : ?Bool;
    notifyPhone : ?Bool;
  };

  type NewUrlPreview = {
    url : Text;
    title : Text;
    description : Text;
    thumbnailUrl : Text;
  };

  /// New ChatMessage — includes urlPreview field for rich link previews.
  type NewChatMessage = {
    id : Nat;
    authorPrincipal : Principal;
    authorName : Text;
    content : Text;
    imageKey : ?Text;
    likes : [Principal];
    dislikes : [Principal];
    shills : [Principal];
    fuds : [Principal];
    replyToId : ?Nat;
    timestamp : Int;
    isDeleted : Bool;
    tab : Text;
    urlPreview : ?NewUrlPreview;
  };

  type AnnouncementType = { #system_notice; #market_tip; #general };
  type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    announcementType : AnnouncementType;
    isPublished : Bool;
    createdAt : Int;
    updatedAt : Int;
  };
  type PriceResult = {
    priceUSD : Float;
    fetchedAt : Int;
    isStale : Bool;
    source : Text;
  };
  type ICP24hStats = {
    high : Float;
    low : Float;
    fetchedAt : Int;
    isStale : Bool;
  };
  type SocialTrendingResult = {
    score : Float;
    fetchedAt : Int;
    isStale : Bool;
  };
  type NewsItem = {
    title : Text;
    source : Text;
    publishedAt : Text;
    url : Text;
  };
  type ExecutionRecord = {
    id : Text;
    targetPrice : Float;
    tokensSold : Float;
    saleValue : Float;
    executedAt : Int;
    remainingICP : Float;
  };
  type MarketDataPoint = {
    timestamp : Int;
    priceUSD : Float;
    volume24h : Float;
    fearGreedScore : Nat;
  };

  type NewActor = {
    portfolioRecords : Map.Map<Principal, PortfolioRecord>;
    userSettings : Map.Map<Principal, UserSettings>;
    chatMessages : List.List<NewChatMessage>;
    chatState : { var nextId : Nat };
    marketHistory : List.List<MarketDataPoint>;
    executionHistory : Map.Map<Principal, [ExecutionRecord]>;
    announcements : Map.Map<Nat, Announcement>;
    announcementState : { var nextId : Nat };
    priceCache : { var value : ?PriceResult };
    stats24hCache : { var value : ?ICP24hStats };
    socialCache : { var value : ?SocialTrendingResult };
    newsCacheDfinity : { var items : [NewsItem]; var fetchedAt : Int };
    newsCacheCT : { var items : [NewsItem]; var fetchedAt : Int };
    newsCacheDecrypt : { var items : [NewsItem]; var fetchedAt : Int };
    donationAddressStore : { var value : Text };
  };

  public func run(old : OldActor) : NewActor {
    // portfolioRecords: shape is identical between old and new — pass through as-is.
    let portfolioRecords = old.portfolioRecords;

    // userSettings: shape is identical (both already have notifyEmail/notifyPhone) — pass through.
    let userSettings = old.userSettings;

    // chatMessages: pass through all fields; urlPreview is optional so old records get null.
    let chatMessages = old.chatMessages.map<OldChatMessage, NewChatMessage>(
      func(m) {
        {
          id              = m.id;
          authorPrincipal = m.authorPrincipal;
          authorName      = m.authorName;
          content         = m.content;
          imageKey        = m.imageKey;
          likes           = m.likes;
          dislikes        = m.dislikes;
          shills          = m.shills;
          fuds            = m.fuds;
          replyToId       = m.replyToId;
          timestamp       = m.timestamp;
          isDeleted       = m.isDeleted;
          tab             = m.tab;
          urlPreview      = null;
        }
      }
    );

    // All other fields pass through unchanged.
    {
      portfolioRecords;
      userSettings;
      chatMessages;
      chatState               = old.chatState;
      marketHistory           = old.marketHistory;
      executionHistory        = old.executionHistory;
      announcements           = old.announcements;
      announcementState       = old.announcementState;
      priceCache              = old.priceCache;
      stats24hCache           = old.stats24hCache;
      socialCache             = old.socialCache;
      newsCacheDfinity        = old.newsCacheDfinity;
      newsCacheCT             = old.newsCacheCT;
      newsCacheDecrypt        = old.newsCacheDecrypt;
      donationAddressStore    = old.donationAddressStore;
    };
  };
};
