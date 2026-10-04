import { invoke as tauriInvoke, isTauri as detectTauri } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';

// Check if running in Tauri or browser. Tauri v2 only defines window.__TAURI__ when
// app.withGlobalTauri is enabled (it isn't), so use the API's own check.
const isTauri = detectTauri();

// Mock data for browser development mode
const getMockData = (command: string, args?: Record<string, unknown>): any => {
  switch (command) {
    case 'get_daemon_status':
      return {
        running: false,
        modelLoaded: false,
        gpuEnabled: false,
        gpuName: null,
        uptimeSecs: null
      };
    case 'get_config':
      return {
        model: {
          path: '/mock/path/model.bin',
          model_id: 'mock-model',
          language: 'en',
          draft_model_path: null,
          prompt: null
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
        cpuCores: 8,
        totalRamGb: 16.0,
        usedRamGb: 4.2,
        gpuAvailable: false,
        gpuName: null,
        gpuVramMb: null,
        platform: 'Browser Development Mode'
      };
    case 'list_models':
    case 'list_downloaded_models':
      return [
        { name: 'large-v3-turbo', filename: 'whisper-large-v3-turbo', path: '/mock/models/whisper-large-v3-turbo', sizeMb: 1550, isActive: true },
        { name: 'medium', filename: 'whisper-medium', path: '/mock/models/whisper-medium', sizeMb: 3090, isActive: false },
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
        { name: 'large-v3-turbo', filename: 'whisper-large-v3-turbo', sizeMb: 1550, family: 'Large V3 Turbo', quantization: 'Full', format: 'safetensors' },
        { name: 'medium', filename: 'whisper-medium', sizeMb: 3090, family: 'Medium', quantization: 'Full', format: 'safetensors' },
        { name: 'small', filename: 'whisper-small', sizeMb: 970, family: 'Small', quantization: 'Full', format: 'safetensors' },
        { name: 'base.en', filename: 'whisper-base-en', sizeMb: 293, family: 'Base', quantization: 'Full', format: 'safetensors' },
        { name: 'large-v3-turbo-q8', filename: 'whisper-large-v3-turbo-q8-gguf', sizeMb: 478, family: 'Large V3 Turbo', quantization: 'Q8_0', format: 'gguf' },
      ];
    case 'get_storage_info':
      // Bytes, like the real get_storage_info
      return {
        used: 4_865_392_640,
        free: 54_223_962_112,
        total: 107_374_182_400
      };
    case 'validate_path':
      return { valid: true, path: args?.path || '/tmp' };
    case 'vocab_list':
      return [
        { id: 1, term: 'MojoVoice', useCount: 5, source: 'manual', addedAt: Date.now() - 86400000 },
        { id: 2, term: 'Whisper', useCount: 12, source: 'manual', addedAt: Date.now() - 172800000 },
        { id: 3, term: 'Tauri', useCount: 3, source: 'correction', addedAt: Date.now() - 3600000 },
      ];
    case 'vocab_add':
      return { success: true };
    case 'vocab_remove':
      return true;
    case 'vocab_correct':
      return { success: true };
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
