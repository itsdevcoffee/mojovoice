import { create } from 'zustand';
import { type ScalePreset, getScaleValue, applyScale } from '../lib/scale';
import { invoke } from '../lib/ipc';

interface DaemonStatus {
  running: boolean;
  modelLoaded: boolean;
  gpuEnabled: boolean;
  gpuName?: string;
}

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: number;
  durationMs: number;
  model: string;
}

interface IPCCall {
  id: string;
  timestamp: number;
  command: string;
  args?: any;
  result?: any;
  error?: string;
  durationMs: number;
}

interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: 'ui' | 'daemon';
}

interface AppState {
  // Daemon state
  daemonStatus: DaemonStatus;
  isRecording: boolean;
  isProcessing: boolean;

  // Transcription history
  transcriptions: TranscriptionEntry[];

  // Dev tools
  ipcCalls: IPCCall[];
  logs: LogEntry[];

  // UI state
  activeView: 'dashboard' | 'settings' | 'history' | 'devtools' | 'models';

  // UI scaling
  uiScale: number;
  scalePreset: ScalePreset;
  customScale: number;

  // Actions
  setDaemonStatus: (status: DaemonStatus) => void;
  refreshDaemonStatus: () => Promise<void>;
  setRecording: (recording: boolean) => void;
  setProcessing: (processing: boolean) => void;
  addTranscription: (entry: TranscriptionEntry) => void;
  setActiveView: (view: AppState['activeView']) => void;
  addIPCCall: (call: IPCCall) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  clearIPCCalls: () => void;
  setUIScale: (preset: ScalePreset, customValue?: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  daemonStatus: {
    running: false,
    modelLoaded: false,
    gpuEnabled: false,
  },
  isRecording: false,
  isProcessing: false,
  transcriptions: [],
  ipcCalls: [],
  logs: [],
  activeView: 'dashboard',

  // UI scaling defaults
  uiScale: 1.0,
  scalePreset: 'medium',
  customScale: 1.0,

  // Actions
  setDaemonStatus: (status) => set({ daemonStatus: status }),
  refreshDaemonStatus: async () => {
    try {
      const status = await invoke('get_daemon_status') as DaemonStatus;
      set({ daemonStatus: status });
    } catch (error) {
      console.error('Failed to refresh daemon status:', error);
    }
  },
  setRecording: (recording) => set({ isRecording: recording }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  addTranscription: (entry) =>
    set((state) => ({
      transcriptions: [entry, ...state.transcriptions].slice(0, 50) // Keep last 50
    })),
  setActiveView: (view) => set({ activeView: view }),
  addIPCCall: (call) =>
    set((state) => ({
      ipcCalls: [call, ...state.ipcCalls].slice(0, 100) // Keep last 100
    })),
  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 500) // Keep last 500
    })),
  clearLogs: () => set({ logs: [] }),
  clearIPCCalls: () => set({ ipcCalls: [] }),

  // UI scaling actions
  setUIScale: (preset, customValue) => {
    const currentState = get();
    const newCustomScale = preset === 'custom'
      ? (customValue ?? currentState.customScale)
      : currentState.customScale;
    const effectiveScale = getScaleValue(preset, newCustomScale);

    set({
      scalePreset: preset,
      customScale: newCustomScale,
      uiScale: effectiveScale,
    });

    applyScale(effectiveScale);
  },
}));
