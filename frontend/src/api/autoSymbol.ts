import type { Session } from '@supabase/supabase-js';
import { request } from '../lib/api';

export type AutoSlot = {
  slot: number;
  index_name: 'NIFTY' | 'BANKNIFTY' | 'SENSEX';
  moneyness: 'ATM' | 'ITM1' | 'ITM2' | 'OTM1' | 'OTM2';
  lot_count: number;
  enabled: boolean;
  target_per_lot: number;
  stop_loss_per_lot: number;
  trailing_enabled: boolean;
  trailing_activation_per_lot: number;
  trailing_step_per_lot: number;
};

export const defaultSlot = (slot: number): AutoSlot => ({
  slot,
  index_name: 'NIFTY',
  moneyness: 'ATM',
  lot_count: 1,
  enabled: false,
  target_per_lot: 6000,
  stop_loss_per_lot: 3000,
  trailing_enabled: true,
  trailing_activation_per_lot: 4000,
  trailing_step_per_lot: 1000,
});

export async function listSlots(session: Session | null) {
  return request<any>('GET', '/auto-symbol/config', undefined, session?.access_token);
}

export async function saveSlot(session: Session | null, slot: AutoSlot) {
  return request<any>('POST', '/auto-symbol/config', slot, session?.access_token);
}

export async function buyExtraSlot(session: Session | null) {
  return request<any>('POST', '/auto-symbol/purchase-slot', {}, session?.access_token);
}
