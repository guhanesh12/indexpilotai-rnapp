import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { aiChat, ChatMessage, AiConfig, ChatResponse, AiAnswer, AiAction, SlotRow } from '../api/aiChat';
import { emitRefetch } from '../lib/refetchEvents';

interface AIChatState {
  // Config
  config: AiConfig | null;
  configLoading: boolean;
  configError: string | null;

  // Messages
  messages: ChatMessage[];
  messagesLoading: boolean;
  messagesError: string | null;

  // Sending
  sending: boolean;
  sendError: string | null;

  // Actions
  actionLoading: boolean;
  actionError: string | null;

  // Sheet visibility
  sheetVisible: boolean;

  // Wallet balance (from config or chat responses)
  walletBalance: number;

  // Methods
  loadConfig: () => Promise<void>;
  loadHistory: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  executeAction: (action: AiAction) => Promise<void>;
  openSheet: () => void;
  closeSheet: () => void;
  refreshWallet: () => void;
}

const AIChatContext = createContext<AIChatState | null>(null);

// Chat session expiry: 1 hour (in ms)
const CHAT_SESSION_EXPIRY = 60 * 60 * 1000;

export function useAIChat() {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error('useAIChat must be used within AIChatProvider');
  return ctx;
}

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const hasLoadedHistory = useRef(false);
  const lastChatActivity = useRef<number>(Date.now());

  // ─── Load config ──────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const cfg = await aiChat.config();
      setConfig(cfg);
      setWalletBalance(cfg.balance);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) {
        setConfigError('Unauthorized');
      } else if (status === 503) {
        setConfigError('AI assistant is currently disabled');
      } else {
        setConfigError(e?.message || 'Failed to load config');
      }
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // ─── Check if chat session expired (1 hour) ───────────
  const isChatSessionExpired = useCallback(() => {
    return Date.now() - lastChatActivity.current > CHAT_SESSION_EXPIRY;
  }, []);

  // ─── Load history ─────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (hasLoadedHistory.current) return;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const res = await aiChat.history();
      const msgs: ChatMessage[] = (res.messages || []).map((m: any) => ({
        id: m.id || `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: m.role,
        content: m.content,
        answer: m.answer,
        charged: m.charged,
        created_at: m.created_at,
      }));
      setMessages(msgs);
      hasLoadedHistory.current = true;
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) {
        setMessagesError('Unauthorized');
      } else {
        setMessagesError(e?.message || 'Failed to load history');
      }
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // ─── Send message ─────────────────────────────────────
  const sendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 1000) {
      setSendError(trimmed.length > 1000 ? 'Message too long (max 1000 chars)' : 'Message is required');
      return;
    }

    // Update last activity timestamp
    lastChatActivity.current = Date.now();

    setSending(true);
    setSendError(null);

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Build history from existing messages (last 8 turns, assistant turns use answer.summary)
    const history = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.role === 'assistant' && m.answer ? m.answer.summary : m.content,
    }));

    try {
      const resp: ChatResponse = await aiChat.send(trimmed, history);

      // Update wallet balance
      setWalletBalance(resp.balance);

      // Add assistant message
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: resp.reply,
        answer: resp.answer,
        charged: resp.charged,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const status = e?.status;
      const code = e?.code;

      if (status === 401) {
        setSendError('Unauthorized');
      } else if (status === 402 && code === 'INSUFFICIENT_BALANCE') {
        setSendError('INSUFFICIENT_BALANCE');
      } else if (status === 429) {
        setSendError('RATE_LIMIT');
      } else if (status === 502) {
        setSendError('AI_ERROR');
      } else if (status === 503) {
        setSendError('AI_DISABLED');
      } else if (status === 500) {
        setSendError('SERVER_ERROR');
      } else {
        setSendError(e?.message || 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  }, [messages]);

  // ─── Execute action ───────────────────────────────────
  const executeAction = useCallback(async (action: AiAction) => {
    setActionLoading(true);
    setActionError(null);

    try {
      let result: any;

      switch (action.type) {
        case 'place_order':
          if (action.signalId) {
            result = await aiChat.placeOrder(action.signalId);
          }
          break;
        case 'exit_position':
          if (action.orderId) {
            result = await aiChat.exitPosition(action.orderId);
          }
          break;
        case 'start_engine':
          result = await aiChat.engineStart();
          break;
        case 'stop_engine':
          result = await aiChat.engineStop();
          break;
        case 'edit_slot':
          // Build payload from action fields (camelCase -> snake_case mapping done in sheet)
          result = await aiChat.updateSlot({
            slot: action.slot,
            indexName: (action as any).indexName,
            moneyness: (action as any).moneyness,
            lotCount: (action as any).lotCount,
            enabled: (action as any).enabled,
            targetPerLot: (action as any).targetPerLot,
            stopLossPerLot: (action as any).stopLossPerLot,
            trailingEnabled: (action as any).trailingEnabled,
            trailingActivationPerLot: (action as any).trailingActivationPerLot,
            trailingStepPerLot: (action as any).trailingStepPerLot,
          });
          break;
        case 'connect_broker':
          // Just navigate to broker screen - no API call
          break;
        case 'create_ticket': {
          const ticket = action.ticket || { subject: '', message: '', urgency: 'NORMAL', category: 'TECHNICAL' };
          if (!ticket.subject || !ticket.message) {
            setActionError('Please fill in subject and message');
            setActionLoading(false);
            return;
          }
          result = await aiChat.createTicket({
            subject: ticket.subject,
            message: ticket.message,
            urgency: ticket.urgency || 'NORMAL',
            category: ticket.category || 'TECHNICAL',
          });
          break;
        }
        case 'edit_profile': {
          const profile = action.profile || { full_name: '', mobile: '', photo_url: '' };
          const payload: any = {};
          if (profile.full_name) payload.full_name = profile.full_name;
          if (profile.mobile) payload.mobile = profile.mobile;
          if (profile.photo_url) payload.photo_url = profile.photo_url;
          
          if (Object.keys(payload).length === 0) {
            setActionError('Nothing to update');
            setActionLoading(false);
            return;
          }
          
          result = await aiChat.updateProfile(payload);
          break;
        }
        case 'view_journal':
        case 'view_logs':
          // Navigation handled in sheet component
          break;
        case 'none':
          break;
      }

      // On success, append a confirmation bubble
      if (result?.success && result?.message) {
        const confirmMsg: ChatMessage = {
          id: `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: result.message,
          answer: {
            title: 'Done',
            verdict: 'INFO',
            summary: result.message,
            sections: [],
            confidence: 0,
            risk: '',
            action: { type: 'none', label: '', reason: 'no wallet charge' },
          },
          charged: 0,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, confirmMsg]);
      }

      // Refresh relevant screens
      if (action.type === 'place_order' || action.type === 'exit_position') {
        emitRefetch('wallet:refresh');
      }
      if (action.type === 'start_engine' || action.type === 'stop_engine') {
        emitRefetch('wallet:refresh');
      }
      if (action.type === 'edit_slot') {
        emitRefetch('autoSymbols:refresh');
      }
      if (action.type === 'edit_profile') {
        emitRefetch('profile:refresh');
      }
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) {
        setActionError('Unauthorized');
      } else if (status === 402 && e?.code === 'INSUFFICIENT_BALANCE') {
        setActionError('INSUFFICIENT_BALANCE');
      } else if (status === 429) {
        setActionError('RATE_LIMIT');
      } else {
        setActionError(e?.message || 'Action failed');
      }
    } finally {
      setActionLoading(false);
    }
  }, []);

  // ─── Sheet visibility ─────────────────────────────────
  const openSheet = useCallback(() => {
    setSheetVisible(true);
    // Load config when opening
    loadConfig();

    // If chat session expired (1 hour), start fresh - clear old messages and re-enable history load
    if (isChatSessionExpired()) {
      console.log('[AIChat] Session expired (>1hr), starting fresh chat');
      setMessages([]);
      hasLoadedHistory.current = false;
      lastChatActivity.current = Date.now();
    }

    // Load history (will be skipped if just reset)
    loadHistory();
  }, [loadConfig, loadHistory, isChatSessionExpired]);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  // ─── Refresh wallet ───────────────────────────────────
  const refreshWallet = useCallback(() => {
    loadConfig();
  }, [loadConfig]);

  // Auto-load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const value: AIChatState = {
    config,
    configLoading,
    configError,
    messages,
    messagesLoading,
    messagesError,
    sending,
    sendError,
    actionLoading,
    actionError,
    sheetVisible,
    walletBalance,
    loadConfig,
    loadHistory,
    sendMessage,
    executeAction,
    openSheet,
    closeSheet,
    refreshWallet,
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}
