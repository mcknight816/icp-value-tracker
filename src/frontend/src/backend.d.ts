import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface FearGreedResult {
    fetchedAt: bigint;
    labelText: string;
    score: bigint;
}
export interface MarketDataPoint {
    volume24h: number;
    timestamp: bigint;
    fearGreedScore: bigint;
    priceUSD: number;
}
export interface PriceTarget {
    id: string;
    tokensToSell: number;
    notifyViaPhone: boolean;
    targetPrice: number;
    notifyEmail?: string;
    triggered: boolean;
    icpAmount: number;
    notifyViaEmail: boolean;
}
export interface NewsItem {
    url: string;
    title: string;
    source: string;
    publishedAt: string;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface ExecutionRecord {
    id: string;
    saleValue: number;
    executedAt: bigint;
    tokensSold: number;
    targetPrice: number;
    remainingICP: number;
}
export interface PriceResult {
    isStale: boolean;
    fetchedAt: bigint;
    source: string;
    priceUSD: number;
}
export interface UrlPreview {
    url: string;
    title: string;
    thumbnailUrl: string;
    description: string;
}
export type PriceResponse = {
    __kind__: "ok";
    ok: PriceResult;
} | {
    __kind__: "err";
    err: string;
};
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface PortfolioRecord {
    priceTargets: Array<PriceTarget>;
    investedAmount: number;
    icpAmount: number;
}
export interface ICP24hStats {
    low: number;
    isStale: boolean;
    fetchedAt: bigint;
    high: number;
}
export interface UserSettings {
    baseCurrency?: string;
    theme?: string;
    notifyPhone?: boolean;
    email?: string;
    language?: string;
    notifyEmail?: boolean;
    phone?: string;
}
export interface ChatMessage {
    id: bigint;
    tab: string;
    isDeleted: boolean;
    content: string;
    shills: Array<Principal>;
    fuds: Array<Principal>;
    authorName: string;
    likes: Array<Principal>;
    imageKey?: string;
    timestamp: bigint;
    replyToId?: bigint;
    dislikes: Array<Principal>;
    authorPrincipal: Principal;
    urlPreview?: UrlPreview;
}
export interface PriceVolumePoint {
    volume24h: number;
    timestamp: bigint;
    priceUSD: number;
}
export interface Announcement {
    id: bigint;
    title: string;
    announcementType: AnnouncementType;
    isPublished: boolean;
    body: string;
    createdAt: bigint;
    updatedAt: bigint;
}
export interface SocialTrendingResult {
    isStale: boolean;
    fetchedAt: bigint;
    score: number;
}
export enum AnnouncementType {
    market_tip = "market_tip",
    system_notice = "system_notice",
    general = "general"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    checkAndTriggerAlerts(currentPrice: number): Promise<void>;
    createAnnouncement(title: string, body: string, announcementType: AnnouncementType): Promise<bigint>;
    /**
     * / Per-feed news caches (survive upgrades via EOP). Each feed is cached independently
     * / so one failing feed does not evict another feed's previously good items.
     */
    deleteAnnouncement(id: bigint): Promise<boolean>;
    deleteChatMessage(messageId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deletePortfolioRecord(): Promise<void>;
    deleteUserSettings(): Promise<void>;
    fetchAndStoreMarketData(): Promise<void>;
    fetchCoinTelegraphItems(): Promise<Array<NewsItem>>;
    fetchDecryptItems(): Promise<Array<NewsItem>>;
    fetchDfinityBlogItems(): Promise<Array<NewsItem>>;
    /**
     * / Fetches the ICP balance for the admin wallet address via the ICP Ledger API.
     * / Returns the balance as a Text string (e.g. "1234.5678").
     * / Returns "0.0000" if the HTTP outcall fails or the response cannot be parsed.
     */
    getAdminICPBalance(): Promise<string>;
    getAllAnnouncements(): Promise<Array<Announcement>>;
    getCallerUserRole(): Promise<UserRole>;
    getChatMessages(limit: bigint, offset: bigint): Promise<Array<ChatMessage>>;
    getCurrentFearGreed(): Promise<FearGreedResult | null>;
    /**
     * / Returns the current cycles balance of this canister.
     */
    getCyclesBalance(): Promise<bigint>;
    /**
     * / Returns the ICP donation wallet address.
     */
    getDonationAddress(): Promise<string>;
    getExecutionHistory(): Promise<Array<ExecutionRecord>>;
    /**
     * / Returns 24-hour high/low price for ICP. Caches fresh results; returns stale on failure.
     */
    getICP24hStats(): Promise<ICP24hStats | null>;
    /**
     * / Returns recent ICP news items. Each feed is fetched and cached independently
     * / with a 5-minute TTL. Stale cached items are served when a feed fails.
     * / Returns recent ICP news items. Each feed is fetched and cached independently
     * / with a 5-minute TTL. All three feeds are fetched IN PARALLEL so one slow
     * / feed cannot block the others. Stale cached items are served when a feed fails.
     */
    getICPNews(): Promise<Array<NewsItem>>;
    getICPNewsRaw(): Promise<Array<NewsItem>>;
    /**
     * / Fetches the current ICP price, caches successes, and falls back to stale cache.
     * / Returns #ok with isStale=false on a live price, isStale=true for a cached stale
     * / price, or #err only when all sources fail and no cache is available.
     */
    getICPPrice(): Promise<PriceResponse>;
    getICPPriceRaw(): Promise<PriceResponse>;
    getMarketChart(days: bigint): Promise<Array<PriceVolumePoint>>;
    getMarketHistory(): Promise<Array<MarketDataPoint>>;
    getPortfolioRecord(): Promise<PortfolioRecord>;
    getPublishedAnnouncements(): Promise<Array<Announcement>>;
    /**
     * / Returns the ICP social trending score (0-100). Caches result; returns stale on failure.
     */
    getSocialTrending(): Promise<SocialTrendingResult>;
    /**
     * / Cached 24-hour high/low stats (survives upgrades via EOP).
     */
    getUserSettings(): Promise<UserSettings>;
    isCallerAdmin(): Promise<boolean>;
    postChatMessage(content: string, imageKey: string | null, replyToId: bigint | null, urlPreview: UrlPreview | null): Promise<{
        __kind__: "ok";
        ok: ChatMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveExecutionRecord(record: ExecutionRecord): Promise<void>;
    savePortfolioRecord(icpAmount: number, investedAmount: number, priceTargets: Array<PriceTarget>): Promise<void>;
    /**
     * / Persistent announcements store (keyed by Nat id).
     */
    saveUserSettings(email: string | null, phone: string | null, theme: string | null, baseCurrency: string | null, language: string | null, notifyEmail: boolean | null, notifyPhone: boolean | null): Promise<void>;
    sendTestEmail(): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    toggleAnnouncementPublished(id: bigint): Promise<boolean>;
    toggleChatLike(messageId: bigint, isLike: boolean): Promise<{
        __kind__: "ok";
        ok: ChatMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    toggleChatShill(messageId: bigint, isShill: boolean): Promise<{
        __kind__: "ok";
        ok: ChatMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Transform callback for admin ICP balance HTTP responses.
     * / Passes through the full response body without truncation.
     */
    transformAdminBalance(input: TransformationInput): Promise<TransformationOutput>;
    transformBinance24h(input: TransformationInput): Promise<TransformationOutput>;
    transformCoinTelegraphRss(input: TransformationInput): Promise<TransformationOutput>;
    transformDecryptRss(input: TransformationInput): Promise<TransformationOutput>;
    transformDfinityBlog(input: TransformationInput): Promise<TransformationOutput>;
    transformFearGreed(input: TransformationInput): Promise<TransformationOutput>;
    transformMarketChart(input: TransformationInput): Promise<TransformationOutput>;
    transformNewsItems(input: TransformationInput): Promise<TransformationOutput>;
    transformPrice(input: TransformationInput): Promise<TransformationOutput>;
    transformPriceBinance(input: TransformationInput): Promise<TransformationOutput>;
    transformPriceCoinbase(input: TransformationInput): Promise<TransformationOutput>;
    transformSocialStats(input: TransformationInput): Promise<TransformationOutput>;
    updateAnnouncement(id: bigint, title: string, body: string, announcementType: AnnouncementType): Promise<boolean>;
}
