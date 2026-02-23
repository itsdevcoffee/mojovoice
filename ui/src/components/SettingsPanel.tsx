import { useState, useEffect } from 'react';
import { useToast } from './ui/Toast';
import { invoke } from '../lib/ipc';
import SettingsConfigTab from './settings/SettingsConfigTab';
import VocabTab from './settings/VocabTab';

interface Config {
  model: {
    path: string;
    model_id: string;
    language: string;
    prompt: string | null;
  };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
    device_name: string | null;
  };
  output: {
    display_server: string | null;
    append_space: boolean;
    refresh_command: string | null;
  };
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface AudioDevice {
  name: string;
  is_default: boolean;
  internal_name: string | null;
}

interface VocabTerm {
  id: number;
  term: string;
  useCount: number;
  source: string;
  addedAt: number;
}

export default function SettingsPanel() {
  const { toast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(() => {
    const saved = localStorage.getItem('advancedSettings.collapsed');
    return saved === 'false';
  });
  const [activeTab, setActiveTab] = useState<'settings' | 'vocab'>('settings');
  const [savedField, setSavedField] = useState<string | null>(null);

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  };

  // Vocabulary state
  const [vocabTerms, setVocabTerms] = useState<VocabTerm[]>([]);
  const [vocabLoading, setVocabLoading] = useState(true);
  const [newTerm, setNewTerm] = useState('');
  const [wrongTerm, setWrongTerm] = useState('');
  const [rightTerm, setRightTerm] = useState('');

  const loadVocabTerms = async () => {
    try {
      setVocabLoading(true);
      const terms = await invoke<VocabTerm[]>('vocab_list');
      setVocabTerms(terms);
    } catch (error) {
      console.error('Failed to load vocab terms:', error);
    } finally {
      setVocabLoading(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const cfg = await invoke<Config>('get_config');
        setConfig(cfg);

        const models = await invoke<DownloadedModel[]>('list_downloaded_models');
        setDownloadedModels(models);

        const devices = await invoke<AudioDevice[]>('list_audio_devices');
        setAudioDevices(devices);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    loadVocabTerms();
  }, []);

  const handleModelChange = async (path: string) => {
    if (!config) return;
    try {
      const pathParts = path.split('/');
      const filename = pathParts[pathParts.length - 1];
      await invoke('switch_model', { filename });
      const updatedConfig = await invoke<Config>('get_config');
      setConfig(updatedConfig);
      const models = await invoke<DownloadedModel[]>('list_downloaded_models');
      setDownloadedModels(models);
      flashSaved('model');
    } catch (error) {
      console.error('Failed to switch model:', error);
    }
  };

  const handleLanguageChange = async (language: string) => {
    if (!config) return;
    try {
      const updatedConfig = { ...config, model: { ...config.model, language } };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('language');
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleTimeoutChange = async (timeoutSecs: number) => {
    if (!config) return;
    try {
      const updatedConfig = { ...config, audio: { ...config.audio, timeout_secs: timeoutSecs } };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('timeout');
    } catch (error) {
      console.error('Failed to update timeout:', error);
    }
  };

  const handleAudioDeviceChange = async (deviceName: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        audio: { ...config.audio, device_name: deviceName === '' ? null : deviceName },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('device');
    } catch (error) {
      console.error('Failed to update audio device:', error);
    }
  };

  const handleAppendSpaceToggle = async () => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        output: { ...config.output, append_space: !config.output.append_space },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('append_space');
    } catch (error) {
      console.error('Failed to toggle append_space:', error);
    }
  };

  const handleModelPathOverrideChange = async (path: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        model: { ...config.model, path: path.trim() || config.model.path },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('model_path');
    } catch (error) {
      console.error('Failed to update model path:', error);
    }
  };

  const handleRefreshCommandChange = async (command: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        output: { ...config.output, refresh_command: command.trim() || null },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('refresh_cmd');
    } catch (error) {
      console.error('Failed to update refresh command:', error);
    }
  };

  const handleSaveAudioClipsToggle = async () => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        audio: { ...config.audio, save_audio_clips: !config.audio.save_audio_clips },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('save_clips');
    } catch (error) {
      console.error('Failed to toggle save audio clips:', error);
    }
  };

  const handleAudioClipsPathChange = async (path: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        audio: { ...config.audio, audio_clips_path: path.trim() || config.audio.audio_clips_path },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
      flashSaved('clips_path');
    } catch (error) {
      console.error('Failed to update audio clips path:', error);
    }
  };

  const handleVocabAdd = async () => {
    const term = newTerm.trim();
    if (!term) return;
    try {
      await invoke('vocab_add', { term, source: 'manual' });
      setNewTerm('');
      await loadVocabTerms();
    } catch (error) {
      console.error('Failed to add vocab term:', error);
      toast({ message: `Failed to add "${term}"`, variant: 'error' });
    }
  };

  const handleVocabRemove = async (term: string) => {
    try {
      await invoke('vocab_remove', { term });
      await loadVocabTerms();
      toast({
        message: `"${term}" removed from vocabulary`,
        variant: 'undo',
        action: {
          label: 'Undo',
          onClick: async () => {
            await invoke('vocab_add', { term, source: 'manual' });
            await loadVocabTerms();
          },
        },
      });
    } catch (error) {
      console.error('Failed to remove vocab term:', error);
      toast({ message: `Failed to remove "${term}"`, variant: 'error' });
    }
  };

  const handleVocabCorrect = async () => {
    const wrong = wrongTerm.trim();
    const right = rightTerm.trim();
    if (!wrong || !right) return;
    try {
      await invoke('vocab_correct', { wrong, right });
      setWrongTerm('');
      setRightTerm('');
      await loadVocabTerms();
      toast({ message: `Correction recorded: "${wrong}" → "${right}"`, variant: 'success' });
    } catch (error) {
      console.error('Failed to record correction:', error);
      toast({ message: 'Failed to record correction', variant: 'error' });
    }
  };

  const toggleAdvancedSection = () => {
    const newState = !advancedExpanded;
    setAdvancedExpanded(newState);
    localStorage.setItem('advancedSettings.collapsed', String(!newState));
  };

  if (loading || !config) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-secondary)] font-ui">Loading settings...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Two-tab bar */}
      <div className="flex mb-6" role="tablist" aria-label="Settings sections">
        {(['settings', 'vocab'] as const).map((tab, i) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.12em]
              border-2 border-black transition-all duration-150
              ${i > 0 ? 'border-l-0' : ''}
              focus-visible:outline-2 focus-visible:outline-blue-500
              focus-visible:outline-offset-[-2px]
              ${activeTab === tab
                ? 'bg-[var(--accent-primary)] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            {tab === 'settings'
              ? '[SETTINGS]'
              : `[VOCAB${vocabTerms.length > 0 ? ` ${vocabTerms.length}` : ''}]`
            }
          </button>
        ))}
      </div>

      {/* SETTINGS tab panel */}
      <div
        id="tabpanel-settings"
        role="tabpanel"
        aria-labelledby="tab-settings"
        hidden={activeTab !== 'settings'}
      >
        {activeTab === 'settings' && (
          <SettingsConfigTab
            config={config}
            downloadedModels={downloadedModels}
            audioDevices={audioDevices}
            savedField={savedField}
            advancedExpanded={advancedExpanded}
            onModelChange={handleModelChange}
            onLanguageChange={handleLanguageChange}
            onTimeoutChange={handleTimeoutChange}
            onAudioDeviceChange={handleAudioDeviceChange}
            onAppendSpaceToggle={handleAppendSpaceToggle}
            onModelPathOverrideChange={handleModelPathOverrideChange}
            onRefreshCommandChange={handleRefreshCommandChange}
            onSaveAudioClipsToggle={handleSaveAudioClipsToggle}
            onAudioClipsPathChange={handleAudioClipsPathChange}
            onAdvancedToggle={toggleAdvancedSection}
          />
        )}
      </div>

      {/* VOCAB tab panel */}
      <div
        id="tabpanel-vocab"
        role="tabpanel"
        aria-labelledby="tab-vocab"
        hidden={activeTab !== 'vocab'}
      >
        {activeTab === 'vocab' && (
          <VocabTab
            vocabTerms={vocabTerms}
            vocabLoading={vocabLoading}
            newTerm={newTerm}
            wrongTerm={wrongTerm}
            rightTerm={rightTerm}
            onNewTermChange={setNewTerm}
            onWrongTermChange={setWrongTerm}
            onRightTermChange={setRightTerm}
            onVocabAdd={handleVocabAdd}
            onVocabRemove={handleVocabRemove}
            onVocabCorrect={handleVocabCorrect}
          />
        )}
      </div>
    </div>
  );
}
