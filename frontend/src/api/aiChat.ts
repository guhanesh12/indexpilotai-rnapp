import { supabase } from "../lib/supabase";

const BASE = "https://oklgqelcaujxntgjyuis.supabase.co/functions/v1/ai-chat";

export type Verdict = "WAIT" | "PLACE" | "HOLD" | "EXIT" | "INFO";
export type ActionType =
  | "none" | "place_order" | "exit_position"
  | "start_engine" | "stop_engine" | "edit_slot" | "connect_broker"
  | "create_ticket" | "edit_profile" | "view_journal" | "view_logs";

export interface SlotRow {
  slot: number; index_name: string; moneyness: string; lot_count: number; enabled: boolean;
  target_per_lot: number; stop_loss_per_lot: number; trailing_enabled: boolean;
  trailing_activation_per_lot: number; trailing_step_per_lot: number;
}
export interface AiAction {
  type: ActionType; label: string; signalId?: string; orderId?: string;
  slot?: number; current?: SlotRow; reason?: string;
  ticket?: { subject: string; message: string; urgency: string; category: string };
  profile?: { full_name: string; mobile: string; photo_url: string; client_id: string; email: string };
  journal?: { stats: JournalStats; entries: JournalEntry[] };
  logs?: LogEntry[];
}
export interface AiAnswer {
  title: string; verdict: Verdict; summary: string;
  sections: { heading: string; points: string[] }[];
  confidence: number; risk: string; action: AiAction;
}
export interface ChatResponse {
  success: true; reply: string; answer: AiAnswer;
  charged: number; billable: boolean; freeReason: string;
  balance: number; pricePerQuery: number; freeQueriesLeft: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  answer?: AiAnswer | null;
  charged?: number;
  created_at?: string;
}

export interface AiConfig {
  success: boolean;
  enabled: boolean;
  pricePerQuery: number;
  balance: number;
  billingNote: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  urgency: string;
  category: string;
  createdAt: string;
  hasReply: boolean;
}

export interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  side: string;
  pnl: number;
  quantity: number;
  strategy: string;
}

export interface JournalStats {
  total_trades: number;
  total_pnl: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface JournalResponse {
  success: true;
  entries: JournalEntry[];
  stats: JournalStats;
  charged: number;
}

export interface ProfileData {
  full_name: string;
  email: string;
  mobile: string;
  photo_url: string;
  client_id: string;
  kyc_status: string;
  account_status: string;
  subscription_plan: string;
  broker_connected: boolean;
  profile_completion: number;
  joined_at: string;
}

export interface ProfileResponse {
  success: true;
  profile: ProfileData;
  referralCode: string;
  earnings: any;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: string;
}

export interface LogsResponse {
  success: true;
  logs: LogEntry[];
}

async function call<T>(action: string, method: "GET" | "POST" = "GET", body?: any, qs = ""): Promise<T> {
  let data: any = {};
  try {
    data = await supabase.auth.getSession();
  } catch (e: any) {
    console.log('[AIChat] Invalid session:', e?.message || e);
    throw Object.assign(new Error("Unauthorized"), { code: "Unauthorized", status: 401 });
  }
  const token = data.session?.access_token;
  if (!token) throw Object.assign(new Error("Unauthorized"), { code: "Unauthorized", status: 401 });

  const res = await fetch(`${BASE}?action=${action}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(json.message || json.error || `HTTP ${res.status}`), {
      code: json.error, status: res.status, payload: json,
    });
  }
  return json as T;
}

export const aiChat = {
  config: () => call<AiConfig>("config"),
  history: () => call<{ messages: ChatMessage[] }>("history"),
  send: (message: string, history: { role: "user" | "assistant"; content: string }[]) =>
    call<ChatResponse>("chat", "POST", { message, history: history.slice(-8) }),
  placeOrder: (signalId: string) => call<any>("place-order", "POST", { signalId }),
  exitPosition: (orderId: string) => call<any>("exit-position", "POST", { orderId }),
  engineStart: () => call<any>("engine-start", "POST", {}),
  engineStop: () => call<any>("engine-stop", "POST", {}),
  slotDetails: (slot: number) => call<{ slot: SlotRow | null }>("slot-details", "POST", { slot }),
  updateSlot: (p: Partial<{
    slot: number; indexName: string; moneyness: string; lotCount: number; enabled: boolean;
    targetPerLot: number; stopLossPerLot: number; trailingEnabled: boolean;
    trailingActivationPerLot: number; trailingStepPerLot: number;
  }>) => call<any>("update-slot", "POST", p),
  brokerStatus: () => call<any>("broker-status", "POST", {}),
  
  // Support tickets
  createTicket: (payload: { subject: string; message: string; urgency?: string; category?: string }) =>
    call<{ success: true; ticketId: string; message: string; charged: number }>("create-ticket", "POST", payload),
  getSupportTickets: () => call<{ success: true; tickets: SupportTicket[] }>("support-tickets", "POST"),
  
  // Journal
  getJournal: (limit = 50) => call<JournalResponse>("journal", "POST", { limit }),
  
  // Profile
  getProfile: () => call<ProfileResponse>("profile", "POST"),
  updateProfile: (payload: { full_name?: string; mobile?: string; photo_url?: string }) =>
    call<{ success: true; profile: ProfileData; message: string }>("update-profile", "POST", payload),
  
  // Logs
  getLogs: (limit = 50) => call<LogsResponse>("logs", "POST", { limit }),
};
