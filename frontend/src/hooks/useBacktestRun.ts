import { useState, useCallback, useRef } from 'react';
import { backtestApi, type BacktestResult, type BacktestRunRow } from '../lib/backtestApi';

export interface UseBacktestRunReturn {
  loading: boolean;
  progress: number;
  error: string | null;
  report: BacktestResult | null;
  wallet: number | null;
  history: BacktestRunRow[];
  run: (config: {
    strategy: string;
    indices: string[];
    initialCapital: number;
    fromDate: string;
    toDate: string;
    lots: Record<string, number>;
    maxTradesPerDay: number;
    minConfidence: number;
  }) => Promise<void>;
  cancel: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadWallet: () => Promise<void>;
}

export function useBacktestRun(): UseBacktestRunReturn {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BacktestResult | null>(null);
  const [wallet, setWallet] = useState<number | null>(null);
  const [history, setHistory] = useState<BacktestRunRow[]>([]);

  const runIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await backtestApi.getHistory();
      setHistory(data.runs || []);
    } catch {
      // silent
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const data = await backtestApi.getWalletBalance();
      const b = (data as any)?.balance ?? (data as any)?.data?.balance ?? (data as any)?.wallet?.balance ?? null;
      if (b !== null && b !== undefined) setWallet(Number(b));
    } catch {
      // silent
    }
  }, []);

  const cancel = useCallback(async () => {
    const rid = runIdRef.current;
    if (!rid) return;
    try {
      const res = await backtestApi.abort(rid);
      if (res.refunded) {
        setWallet(res.walletBalance);
      }
    } catch {
      // silent
    } finally {
      runIdRef.current = null;
      setLoading(false);
      setProgress(0);
    }
  }, []);

  const run = useCallback(
    async (config: {
      strategy: string;
      indices: string[];
      initialCapital: number;
      fromDate: string;
      toDate: string;
      lots: Record<string, number>;
      maxTradesPerDay: number;
      minConfidence: number;
    }) => {
      setLoading(true);
      setProgress(0);
      setError(null);
      setReport(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const beginRes = await backtestApi.begin({
          strategy: config.strategy,
          indices: config.indices as any,
          initialCapital: config.initialCapital,
          fromDate: config.fromDate,
          toDate: config.toDate,
          lots: config.lots as any,
          maxTradesPerDay: config.maxTradesPerDay,
          minConfidence: config.minConfidence,
        });

        runIdRef.current = beginRes.runId;
        setWallet(beginRes.walletBalance);

        const tasks = beginRes.tasks || [];
        let done = 0;
        const total = tasks.length;

        const queue = [...tasks];
        const workers: Promise<void>[] = [];

        const worker = async () => {
          while (queue.length > 0 && !controller.signal.aborted) {
            const task = queue.shift();
            if (!task) break;
            try {
              await backtestApi.segment({
                runId: beginRes.runId,
                index: task.index,
                from: task.from,
                to: task.to,
              });
            } catch (e: any) {
              const msg = String(e?.message || '');
              if (msg.includes('404') || msg.includes('expired')) {
                await backtestApi.abort(beginRes.runId).catch(() => {});
                runIdRef.current = null;
                setLoading(false);
                setProgress(0);
                throw new Error('Backtest session expired, please run again.');
              }
              throw e;
            } finally {
              done += 1;
              setProgress(Math.round((done / total) * 100));
            }
          }
        };

        const concurrency = Math.min(3, total || 1);
        for (let i = 0; i < concurrency; i++) {
          workers.push(worker());
        }

        await Promise.all(workers);

        if (controller.signal.aborted) return;

        const finalizeRes = await backtestApi.finalize(beginRes.runId);
        setReport(finalizeRes.report);
        setWallet(finalizeRes.walletBalance);
        setProgress(100);
        runIdRef.current = null;
        await loadHistory();
      } catch (e: any) {
        const rid = runIdRef.current;
        if (rid) {
          try {
            const abortRes = await backtestApi.abort(rid);
            if (abortRes.refunded) {
              setWallet(abortRes.walletBalance);
              setError((e?.message || 'Backtest failed') + ' — ₹5 refunded to your wallet.');
            } else {
              setError(e?.message || 'Backtest failed');
            }
          } catch {
            setError(e?.message || 'Backtest failed');
          } finally {
            runIdRef.current = null;
          }
        } else {
          setError(e?.message || 'Backtest failed');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          abortControllerRef.current = null;
        }
      }
    },
    [loadHistory]
  );

  return {
    loading,
    progress,
    error,
    report,
    wallet,
    history,
    run,
    cancel,
    loadHistory,
    loadWallet,
  };
}
