import { UserRole } from "../backend";
import type { backendInterface } from "../backend";

let _savedPortfolio = { icpAmount: 0, investedAmount: 0, priceTargets: [] as Array<import('@/backend').PriceTarget> };

const MOCK_SCORES = [22, 35, 48, 61, 74, 88, 55, 40, 30, 65];
const MOCK_LABELS = [
  "Extreme Fear",
  "Fear",
  "Neutral",
  "Greed",
  "Greed",
  "Extreme Greed",
  "Neutral",
  "Fear",
  "Fear",
  "Greed",
];

function mockHistoryPoints() {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => {
    const idx = i % MOCK_SCORES.length;
    return {
      timestamp: BigInt((now - (29 - i) * 86_400_000) * 1_000_000),
      priceUSD: 12.47 + Math.sin(i * 0.4) * 1.5,
      volume24h: 25_000_000 + Math.cos(i * 0.3) * 5_000_000,
      fearGreedScore: BigInt(MOCK_SCORES[idx]),
    };
  });
}

function mockChartPoints(days: bigint) {
  const now = Date.now();
  const n = Number(days) * 4; // ~4 points per day
  return Array.from({ length: n }, (_, i) => ({
    timestamp: BigInt(
      (now - (Number(days) * 86_400_000 * (n - i)) / n) * 1_000_000,
    ),
    priceUSD: 12.47 + Math.sin(i * 0.2) * 2.0,
    volume24h: 25_000_000 + Math.cos(i * 0.15) * 6_000_000,
  }));
}

export const mockBackend: backendInterface = {
  assignCallerUserRole: async (_user, _role) => {},
  getCallerUserRole: async () => UserRole.user,
  isCallerAdmin: async () => false,
  getICPPrice: async () => ({
    __kind__: "ok",
    ok: {
      priceUSD: 12.47,
      fetchedAt: BigInt(Date.now() * 1_000_000),
      isStale: false,
      source: "CoinGecko",
    },
  }),
  getPortfolioRecord: async () => ({ ..._savedPortfolio }),
  savePortfolioRecord: async (icpAmount: number, investedAmount: number, priceTargets: Array<import('@/backend').PriceTarget>) => {
    _savedPortfolio = { icpAmount, investedAmount, priceTargets };
  },
  fetchAndStoreMarketData: async () => {},
  getCurrentFearGreed: async () => ({
    score: BigInt(MOCK_SCORES[5]),
    labelText: MOCK_LABELS[5],
    fetchedAt: BigInt(Date.now() * 1_000_000),
  }),
  getMarketHistory: async () => mockHistoryPoints(),
  getMarketChart: async (days: bigint) => mockChartPoints(days),
  transformPrice: async (input) => ({
    status: BigInt(200),
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformFearGreed: async (input) => ({
    status: BigInt(200),
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformMarketChart: async (input) => ({
    status: BigInt(200),
    body: input.response.body,
    headers: input.response.headers,
  }),
  checkAndTriggerAlerts: async (_currentPrice: number) => {},
  getICPPriceRaw: async () => ({ __kind__: "err" as const, err: "not implemented" }),

  transformPriceBinance: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformPriceCoinbase: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  getUserSettings: async () => ({}),
  saveUserSettings: async (_email: string | null, _phone: string | null, _theme: string | null, _baseCurrency: string | null, _language: string | null, _notifyEmail: boolean | null, _notifyPhone: boolean | null) => {},
  deletePortfolioRecord: async () => {},
  deleteUserSettings: async () => {},
  getExecutionHistory: async () => [],
  saveExecutionRecord: async (_record: import('@/backend').ExecutionRecord) => {},
  getICP24hStats: async () => ({
    high: 12.5,
    low: 10.2,
    fetchedAt: BigInt(Date.now() * 1_000_000),
    isStale: false,
  }),
  getSocialTrending: async () => ({
    score: 55.0,
    fetchedAt: BigInt(Date.now() * 1_000_000),
    isStale: false,
  }),
  getDonationAddress: async () => "c7e75d3a8a9b5e8f1d2c3a4b5e6f7890a1b2c3d4e5f6789012345678901234a",
  getICPNews: async () => [],
  getICPNewsRaw: async () => [],
  transformBinance24h: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformSocialStats: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformNewsItems: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformCoinDeskRss: async (input: import('@/backend').TransformationInput): Promise<import('@/backend').TransformationOutput> => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformCoinTelegraphRss: async (_input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: new Uint8Array(),
    headers: [],
  }),
  transformDecryptRss: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  transformDfinityBlog: async (input: import('@/backend').TransformationInput) => ({
    status: 200n as bigint,
    body: input.response.body,
    headers: input.response.headers,
  }),
  fetchDfinityBlogItems: async () => [],
  fetchCoinTelegraphItems: async () => [],
  fetchDecryptItems: async () => [],
  fetchCoinDeskItems: async () => [],
  // ─── Announcements ────────────────────────────────────────────────────────
  createAnnouncement: async (_title: string, _body: string, _announcementType: import('@/backend').AnnouncementType) => 1n,
  deleteAnnouncement: async (_id: bigint) => true,
  getAllAnnouncements: async () => [],
  getPublishedAnnouncements: async () => [],
  toggleAnnouncementPublished: async (_id: bigint) => true,
  updateAnnouncement: async (_id: bigint, _title: string, _body: string, _announcementType: import('@/backend').AnnouncementType) => true,
  // ─── Admin balance ────────────────────────────────────────────────────────
  getAdminICPBalance: async (): Promise<string> => "0.0000",  sendTestEmail: async () => ({ __kind__: 'ok' as const, ok: 'Test email sent' }),

  transformAdminBalance: async (input: import('@/backend').TransformationInput): Promise<import('@/backend').TransformationOutput> => ({
    status: 200n,
    body: input.response.body,
    headers: input.response.headers,
  }),
  // ─── Community Chat ───────────────────────────────────────────────────────
  getChatMessages: async (_limit: bigint, _offset: bigint): Promise<Array<import('@/backend').ChatMessage>> => [],
  postChatMessage: async (_content: string, _imageKey: string | null, _replyToId: bigint | null, _urlPreview: import('@/backend').UrlPreview | null) => ({ __kind__: 'ok' as const, ok: { id: 1n, tab: 'icp', isDeleted: false, content: _content, authorName: 'Mock User', likes: [], dislikes: [], shills: [], fuds: [], timestamp: BigInt(Date.now() * 1_000_000), authorPrincipal: {} as import('@icp-sdk/core/principal').Principal, urlPreview: undefined } }),
  toggleChatLike: async (_messageId: bigint, _isLike: boolean) => ({ __kind__: 'ok' as const, ok: { id: _messageId, tab: 'icp', isDeleted: false, content: '', authorName: 'Mock User', likes: [], dislikes: [], shills: [], fuds: [], timestamp: BigInt(Date.now() * 1_000_000), authorPrincipal: {} as import('@icp-sdk/core/principal').Principal, urlPreview: undefined, replyToId: undefined } }),
  toggleChatShill: async (_messageId: bigint, _isShill: boolean) => ({ __kind__: 'ok' as const, ok: { id: _messageId, tab: 'icp', isDeleted: false, content: '', authorName: 'Mock User', likes: [], dislikes: [], shills: [], fuds: [], timestamp: BigInt(Date.now() * 1_000_000), authorPrincipal: {} as import('@icp-sdk/core/principal').Principal, urlPreview: undefined, replyToId: undefined } }),
  deleteChatMessage: async (_messageId: bigint) => ({ __kind__: 'ok' as const, ok: null }),
  getCyclesBalance: async (): Promise<bigint> => 0n,
  _initializeAccessControl: async () => {},
  };
