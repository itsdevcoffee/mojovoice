import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '../lib/ipc';

export interface DownloadProgress {
  modelName: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  status: 'downloading' | 'verifying' | 'complete' | 'error' | 'cancelled';
  error?: string;
}

export function useModelDownload() {
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const timeoutIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    isMountedRef.current = true;

    const setupListener = async () => {
      try {
        console.log('[useModelDownload] Setting up download-progress listener');
        unlisten = await listen<DownloadProgress>('download-progress', (event) => {
          console.log('[useModelDownload] Received event:', event);
          // Skip if component unmounted
          if (!isMountedRef.current) return;

          const progress = event.payload;
          console.log('[useModelDownload] Progress payload:', progress);
          const isFinished = progress.status === 'complete' || progress.status === 'error' || progress.status === 'cancelled';

          setDownloads(prev => {
            const next = new Map(prev);
            next.set(progress.modelName, progress);
            return next;
          });

          // Remove finished downloads after a delay (only if still mounted)
          if (isFinished && isMountedRef.current) {
            const timeoutId = setTimeout(() => {
              if (isMountedRef.current) {
                setDownloads(current => {
                  const updated = new Map(current);
                  updated.delete(progress.modelName);
                  return updated;
                });
              }
              timeoutIds.current.delete(timeoutId);
            }, 3000);
            timeoutIds.current.add(timeoutId);
          }
        });
      } catch (error) {
        console.error('Failed to set up download progress listener:', error);
      }
    };

    setupListener();

    return () => {
      isMountedRef.current = false;
      if (unlisten) {
        unlisten();
      }
      // Clear all pending timeouts to prevent memory leaks
      timeoutIds.current.forEach(clearTimeout);
      timeoutIds.current.clear();
    };
  }, []);

  const startDownload = useCallback(async (modelName: string) => {
    // Initialize progress state
    setDownloads(prev => {
      const next = new Map(prev);
      next.set(modelName, {
        modelName,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        status: 'downloading',
      });
      return next;
    });

    await invoke('download_model', { modelName });
  }, []);

  const isDownloading = useCallback((modelName: string) => {
    const progress = downloads.get(modelName);
    return progress?.status === 'downloading' || progress?.status === 'verifying';
  }, [downloads]);

  const getProgress = useCallback((modelName: string) => {
    return downloads.get(modelName);
  }, [downloads]);

  const cancelDownload = useCallback(async (modelName: string) => {
    try {
      await invoke('cancel_download', { modelName });
      console.log('[useModelDownload] Cancellation requested for:', modelName);
    } catch (error) {
      console.error('[useModelDownload] Failed to cancel download:', error);
    }
  }, []);

  return {
    downloads,
    startDownload,
    cancelDownload,
    isDownloading,
    getProgress,
    activeDownloads: Array.from(downloads.values()).filter(
      d => d.status === 'downloading' || d.status === 'verifying'
    ),
  };
}
