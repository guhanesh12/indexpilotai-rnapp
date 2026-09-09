/**
 * Broker API client.
 *
 * Follows the exact contract from the broker integration spec:
 * - GET /broker/active
 * - POST /broker/active
 * - GET /brokers
 * - Per-broker status/instrument sync for non-Dhan brokers only
 */

import { request } from '../lib/api';
import { brokerBase, brokerStatusPath, brokerInstrumentsStatusPath, brokerInstrumentsSyncPath, brokerActivePath, brokerCatalogPath } from '../broker/brokerPaths';

export const SYNC_CAPABLE = ['zerodha', 'groww', 'upstox', 'fyers', 'angelone', 'aliceblue', '5paisa'] as const;

const SEGMENT: Record<string, string> = {
  zerodha: 'kite',
};

export class UnsupportedBrokerError extends Error {
  constructor(broker: string) {
    super(`${broker} does not support instrument sync`);
    this.name = 'UnsupportedBrokerError';
  }
}

export function isSyncCapable(broker: string): boolean {
  return SYNC_CAPABLE.includes(broker as any);
}

export function brokerSegment(broker: string): string {
  return SEGMENT[broker] || broker;
}

export interface BrokerActive {
  success: boolean;
  activeBroker: string;
  activeBrokerName: string;
  chosen: boolean;
  connected: boolean;
  available: Record<string, boolean>;
  brokers: any[];
}

export interface BrokerCatalog {
  success: boolean;
  brokers: any[];
}

export interface InstrumentStatus {
  success: boolean;
  count: number;
  updatedAt?: string;
}

export interface InstrumentSyncResult {
  success: boolean;
  count: number;
}

export const brokerApi = {
  getBrokerActive: async (): Promise<BrokerActive> => {
    return request('GET', brokerActivePath());
  },

  setBrokerActive: async (broker: string): Promise<void> => {
    await request('POST', brokerActivePath(), { broker });
  },

  getBrokerCatalog: async (): Promise<BrokerCatalog> => {
    return request('GET', brokerCatalogPath());
  },

  getInstrumentStatus: async (broker: string): Promise<InstrumentStatus> => {
    if (!isSyncCapable(broker)) {
      throw new UnsupportedBrokerError(broker);
    }
    const segment = brokerSegment(broker);
    return request('GET', brokerInstrumentsStatusPath(segment));
  },

  syncInstruments: async (broker: string): Promise<InstrumentSyncResult> => {
    if (!isSyncCapable(broker)) {
      throw new UnsupportedBrokerError(broker);
    }
    const segment = brokerSegment(broker);
    return request('POST', brokerInstrumentsSyncPath(segment), {});
  },
};
