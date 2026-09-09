import { fetchApi } from './api';

export type IndexName = 'NIFTY' | 'BANKNIFTY' | 'SENSEX';

export interface BTTrade {
  index: IndexName;
  direction: 'BUY_CALL' | 'BUY_PUT';
  date: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  lots: number;
  qty: number;
  premiumEntry: number;
  premiumExit: number;
  pnl: number;
  confidence: number;
  reason: string;
}

export interface BacktestSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnL: number;
  roi: number;
  profitFactor: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  tradingDays: number;
  profitDays: number;
  lossDays: number;
  flatDays: number;
  dayWinRate: number;
  avgDaily: number;
  avgWeekly: number;
  avgMonthly: number;
  projectedYearly: number;
}

export interface BacktestResult {
  strategy: string;
  indices: IndexName[];
  fromDate: string;
  toDate: string;
  initialCapital: number;
  finalCapital: number;
  summary: BacktestSummary;
  daily: { period: string; pnl: number; trades: number }[];
  weekly: { period: string; pnl: number; trades: number }[];
  monthly: { period: string; pnl: number; trades: number }[];
  yearly: { period: string; pnl: number; trades: number }[];
  byIndex: { index: IndexName; trades: number; wins: number; winRate: number; pnl: number }[];
  equityCurve: { date: string; equity: number }[];
  trades: BTTrade[];
}

export interface BacktestRunRow {
  id: string;
  strategy: string;
  indices: IndexName[];
  initial_capital: number;
  from_date: string;
  to_date: string;
  cost: number;
  summary: BacktestSummary;
  by_index: { index: IndexName; trades: number; wins: number; winRate: number; pnl: number }[];
  created_at: string;
}

export interface BacktestTask {
  index: IndexName;
  from: string;
  to: string;
}

export interface BacktestBeginResponse {
  success: boolean;
  runId: string;
  tasks: BacktestTask[];
  walletBalance: number;
  cost: number;
}

export interface BacktestSegmentResponse {
  success: boolean;
  trades: number;
}

export interface BacktestFinalizeResponse {
  success: boolean;
  report: BacktestResult;
  walletBalance: number;
}

export interface BacktestAbortResponse {
  success: boolean;
  refunded: boolean;
  walletBalance: number;
}

export interface BacktestHistoryResponse {
  success: boolean;
  runs: BacktestRunRow[];
}

export interface BacktestRunDetailResponse {
  success: boolean;
  run: BacktestRunRow & { report: BacktestResult };
}

export const backtestApi = {
  getWalletBalance: async () => {
    return fetchApi('/wallet/balance');
  },

  begin: async (payload: {
    strategy: string;
    indices: IndexName[];
    initialCapital: number;
    fromDate: string;
    toDate: string;
    lots: Record<IndexName, number>;
    maxTradesPerDay: number;
    minConfidence: number;
  }): Promise<BacktestBeginResponse> => {
    return fetchApi('/backtest/strategy/begin', {
      method: 'POST',
      body: payload,
    });
  },

  segment: async (payload: { runId: string; index: IndexName; from: string; to: string }): Promise<BacktestSegmentResponse> => {
    return fetchApi('/backtest/strategy/segment', {
      method: 'POST',
      body: payload,
    });
  },

  finalize: async (runId: string): Promise<BacktestFinalizeResponse> => {
    return fetchApi('/backtest/strategy/finalize', {
      method: 'POST',
      body: { runId },
    });
  },

  abort: async (runId: string): Promise<BacktestAbortResponse> => {
    return fetchApi('/backtest/strategy/abort', {
      method: 'POST',
      body: { runId },
    });
  },

  getHistory: async (): Promise<BacktestHistoryResponse> => {
    return fetchApi('/backtest/strategy/history');
  },

  getRun: async (id: string): Promise<BacktestRunDetailResponse> => {
    return fetchApi(`/backtest/strategy/run/${encodeURIComponent(id)}`);
  },
};
