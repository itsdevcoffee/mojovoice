import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';

// Check if running in Tauri or browser
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// Mock data for browser development mode
const getMockData = (command: string, args?: Record<string, unknown>): any => {
  switch (command) {
    case 'get_daemon_status':
      return {
        running: false,
        model_loaded: false,
        gpu_enabled: false,
        gpu_name: null,
        uptime_secs: null
      };
    case 'get_config':
      return {
        model: {
          path: '/mock/path/model.bin',
          model_id: 'mock-model',
          language: 'en',
          prompt_biasing: null
        },
        audio: {
          sample_rate: 16000,
          timeout_secs: 30,
          save_audio_clips: false,
          audio_clips_path: '/tmp/audio',
          device_name: 'Default Microphone'
        },
        output: {
          display_server: null,
          append_space: false,
          refresh_command: null
        },
        ui: {
          scale_preset: 'medium',
          custom_scale: 1.0
        }
      };
    case 'get_system_info':
      return {
        cpu_cores: 8,
        total_ram_gb: 16.0,
        gpu_available: false,
        gpu_name: null,
        gpu_vram_mb: null,
        platform: 'Browser Development Mode'
      };
    case 'list_models':
    case 'list_downloaded_models':
      return [
        { name: 'Whisper Large V3 Turbo', filename: 'large-v3-turbo.bin', path: '/mock/models/large-v3-turbo.bin', sizeMb: 1550, isActive: true },
        { name: 'Whisper Medium', filename: 'medium.bin', path: '/mock/models/medium.bin', sizeMb: 1540, isActive: false },
      ];
    case 'get_history':
    case 'get_transcription_history':
      return {
        entries: [
          {
            id: 'mock-1',
            text: 'The quick brown fox jumps over the lazy dog. This is a test transcription generated in browser development mode to verify the UI rendering.',
            timestamp: Date.now() - 120000,
            durationMs: 5000,
            model: 'large-v3-turbo',
            latencyMs: 1250,
            confidenceScore: 94.5,
          },
          {
            id: 'mock-2',
            text: 'Kubernetes cluster deployment requires careful consideration of pod scheduling, resource limits, and network policies.',
            timestamp: Date.now() - 3600000,
            durationMs: 4200,
            model: 'large-v3-turbo',
            latencyMs: 980,
            confidenceScore: 88.2,
          },
          {
            id: 'mock-3',
            text: 'Hey, can you review the pull request I sent earlier? I think the TypeScript types need some work.',
            timestamp: Date.now() - 86400000,
            durationMs: 3800,
            model: 'large-v3-turbo',
            latencyMs: 1100,
            confidenceScore: 91.0,
          },
          {
            id: 'mock-4',
            text: 'Meeting notes: discussed Q3 roadmap, agreed on prioritizing performance improvements and accessibility audit.',
            timestamp: Date.now() - 172800000,
            durationMs: 6500,
            model: 'medium',
            latencyMs: 2400,
            confidenceScore: 76.8,
          },
        ],
        total: 4,
        hasMore: false,
        models: ['large-v3-turbo', 'medium'],
      };
    case 'list_audio_devices':
      return [
        { name: 'Default Microphone', isDefault: true },
        { name: 'Built-in Microphone', isDefault: false }
      ];
    case 'list_available_models':
      return [
        { name: 'Whisper Large V3 Turbo', filename: 'large-v3-turbo.bin', size: 1550000000 },
        { name: 'Whisper Medium', filename: 'medium.bin', size: 1540000000 }
      ];
    case 'get_storage_info':
      return {
        available_gb: 50.5,
        total_gb: 100.0,
        models_size_gb: 3.2
      };
    case 'validate_path':
      return { valid: true, path: args?.path || '/tmp' };
    case 'save_config':
    case 'switch_model':
    case 'start_recording':
    case 'stop_recording':
    case 'delete_history_entry':
    case 'clear_history':
    case 'delete_model':
    case 'cancel_download':
    case 'start_daemon':
    case 'stop_daemon':
    case 'restart_daemon':
      return { success: true };
    case 'download_model':
      return { started: true, model_id: args?.model_id || 'model' };
    default:
      console.warn(`No mock data for command: ${command}, returning empty object`);
      return {};
  }
};

/**
 * Wrapper around Tauri's invoke that automatically logs IPC calls to the dev tools
 * Falls back to mock data when running in browser mode (for development)
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const startTime = Date.now();
  const callId = `${command}-${startTime}`;

  try {
    let result: T;

    if (isTauri) {
      result = await tauriInvoke<T>(command, args);
    } else {
      // Browser mode - use mock data
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
      result = getMockData(command, args) as T;
    }

    const durationMs = Date.now() - startTime;

    // Log successful IPC call
    useAppStore.getState().addIPCCall({
      id: callId,
      timestamp: startTime,
      command,
      args,
      result,
      durationMs,
    });

    useAppStore.getState().addLog({
      id: callId,
      timestamp: startTime,
      level: 'info',
      message: `IPC: ${command} completed in ${durationMs}ms`,
      source: 'ui',
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Log failed IPC call
    useAppStore.getState().addIPCCall({
      id: callId,
      timestamp: startTime,
      command,
      args,
      error: String(error),
      durationMs,
    });

    useAppStore.getState().addLog({
      id: callId,
      timestamp: startTime,
      level: 'error',
      message: `IPC: ${command} failed - ${error}`,
      source: 'ui',
    });

    throw error;
  }
}
