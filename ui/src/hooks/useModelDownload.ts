import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '../lib/ipc';

/** Shape of each download in progress, keyed by modelName */
export interface DownloadState {
  modelId: string;
  progress: number; // 0-100
  speedMbps: number;
  etaSecs: number;
  downloadedMb: number;
  totalMb: number;
  status: 'idle' | 'downloading' | 'cancelled' | 'error' | 'done';
  errorMessage?: string;
}

/** Raw event payload emitted by the Tauri backend */
interface RawDownloadProgress {
  modelName: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  status: 'downloading' | 'verifying' | 'complete' | 'error' | 'cancelled';
  error?: string;
}

function toDownloadState(raw: RawDownloadProgress): DownloadState {
  const totalMb = raw.totalBytes / 1_048_576;
  const downloadedMb = raw.downloadedBytes / 1_048_576;
  const progress =
    raw.totalBytes > 0 ? Math.round((raw.downloadedBytes / raw.totalBytes) * 100) : 0;
  const speedMbps = raw.speedBps / 1_048_576;
  const remainingMb = totalMb - downloadedMb;
  const etaSecs = speedMbps > 0 ? Math.round(remainingMb / speedMbps) : 0;

  let status: DownloadState['status'];
  switch (raw.status) {
    case 'complete':
    case 'verifying':
      status = 'done';
      break;
    case 'error':
      status = 'error';
      break;
    case 'cancelled':
      status = 'cancelled';
      break;
    default:
      status = 'downloading';
  }

  return {
    modelId: raw.modelName,
    progress,
    speedMbps,
    etaSecs,
    downloadedMb,
    totalMb,
    status,
    errorMessage: raw.error,
  };
}

export function useModelDownload(onDownloadComplete?: (modelName: string) => void) {
  const [downloads, setDownloads] = useState<Map<string, DownloadState>>(new Map());
  const timeoutIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMountedRef = useRef(true);
  const onDownloadCompleteRef = useRef(onDownloadComplete);

  // Keep ref in sync without re-running the effect
  useEffect(() => {
    onDownloadCompleteRef.current = onDownloadComplete;
  });

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    isMountedRef.current = true;

    const setupListener = async () => {
      try {
        const fn = await listen<RawDownloadProgress>('download-progress', (event) => {
          if (!isMountedRef.current) return;

          const raw = event.payload;
          const state = toDownloadState(raw);
          const isFinished =
            state.status === 'done' ||
            state.status === 'error' ||
            state.status === 'cancelled';

          setDownloads(prev => {
            const next = new Map(prev);
            next.set(raw.modelName, state);
            return next;
          });

          // After a completed download, refresh the downloaded-models list in the parent
          if (state.status === 'done' && isMountedRef.current) {
            onDownloadCompleteRef.current?.(raw.modelName);
          }

          // Remove finished entry after a short delay so the UI can show final state
          if (isFinished && isMountedRef.current) {
            const id = setTimeout(() => {
              if (isMountedRef.current) {
                setDownloads(current => {
                  const updated = new Map(current);
                  updated.delete(raw.modelName);
                  return updated;
                });
              }
              timeoutIds.current.delete(id);
            }, 3000);
            timeoutIds.current.add(id);
          }
        });
        if (!isMountedRef.current) {
          fn(); // component unmounted during await — clean up immediately
          return;
        }
        unlisten = fn;
      } catch (err) {
        console.error('[useModelDownload] Failed to set up listener:', err);
      }
    };

    setupListener();

    return () => {
      isMountedRef.current = false;
      unlisten?.();
      timeoutIds.current.forEach(clearTimeout);
      timeoutIds.current.clear();
    };
  }, []);

  const startDownload = useCallback(async (modelName: string) => {
    // Optimistically mark as downloading so the UI responds immediately
    setDownloads(prev => {
      const next = new Map(prev);
      next.set(modelName, {
        modelId: modelName,
        progress: 0,
        speedMbps: 0,
        etaSecs: 0,
        downloadedMb: 0,
        totalMb: 0,
        status: 'downloading',
      });
      return next;
    });

    try {
      await invoke('download_model', { modelName });
    } catch (err) {
      console.error('[useModelDownload] Failed to start download:', err);
      setDownloads(prev => {
        const next = new Map(prev);
        next.set(modelName, {
          modelId: modelName,
          progress: 0,
          speedMbps: 0,
          etaSecs: 0,
          downloadedMb: 0,
          totalMb: 0,
          status: 'error',
          errorMessage: String(err),
        });
        return next;
      });
    }
  }, []);

  const cancelDownload = useCallback(async (modelName: string) => {
    try {
      await invoke('cancel_download', { modelName });
    } catch (err) {
      console.error('[useModelDownload] Failed to cancel download:', err);
      setDownloads(prev => {
        const next = new Map(prev);
        const existing = next.get(modelName);
        if (existing) {
          next.set(modelName, {
            ...existing,
            status: 'error',
            errorMessage: 'Cancel failed — download may still be running',
          });
        }
        return next;
      });
    }
  }, []);

  const isDownloading = useCallback(
    (modelName: string) => {
      const state = downloads.get(modelName);
      return state?.status === 'downloading';
    },
    [downloads],
  );

  const getDownloadState = useCallback(
    (modelName: string): DownloadState | undefined => downloads.get(modelName),
    [downloads],
  );

  return {
    downloads,
    startDownload,
    cancelDownload,
    isDownloading,
    getDownloadState,
    activeDownloads: (Array.from(downloads.values()) as DownloadState[]).filter(d => d.status === 'downloading'),
  };
}
