import { useEffect } from 'react';
import { invoke } from './lib/ipc';
import { useAppStore } from './stores/appStore';
import MissionControl from './components/MissionControl';
// Old components commented out - will be integrated into MissionControl in later iterations
// import Navigation from './components/Navigation';
// import Dashboard from './components/Dashboard';
// import DevTools from './components/DevTools';
// import Settings from './components/Settings';
// import ModelManagement from './components/ModelManagement';
// import TranscriptionHistory from './components/TranscriptionHistory';
import './styles/globals.css';
import { type ScalePreset, isValidPreset, clampScale } from './lib/scale';

function App() {
  const { setDaemonStatus, addLog, setUIScale } = useAppStore();

  useEffect(() => {
    // Add initial log
    addLog({
      id: Date.now().toString(),
      timestamp: Date.now(),
      level: 'info',
      message: 'Mojo Voice UI started',
      source: 'ui',
    });

    // Load UI scale from config
    const loadUIScale = async () => {
      try {
        const config = await invoke<{ ui?: { scale_preset?: string; custom_scale?: number } }>('get_config');

        // Validate preset and fallback to medium if invalid
        const presetValue = config.ui?.scale_preset ?? 'medium';
        const preset: ScalePreset = isValidPreset(presetValue) ? presetValue : 'medium';

        // Clamp custom scale to valid bounds
        const customScale = clampScale(config.ui?.custom_scale ?? 1.0);

        setUIScale(preset, customScale);

        addLog({
          id: Date.now().toString(),
          timestamp: Date.now(),
          level: 'info',
          message: `UI scale loaded: ${preset} (${customScale}x)`,
          source: 'ui',
        });
      } catch (error) {
        console.error('Failed to load UI scale:', error);
        // Fallback to default medium
        setUIScale('medium');
      }
    };

    loadUIScale();

    // Check daemon status on mount
    const checkStatus = async () => {
      try {
        const status = await invoke('get_daemon_status');
        setDaemonStatus(status as any);
      } catch (error) {
        console.error('Failed to get daemon status:', error);
        addLog({
          id: Date.now().toString(),
          timestamp: Date.now(),
          level: 'error',
          message: `Failed to connect to daemon: ${error}`,
          source: 'ui',
        });
      }
    };

    checkStatus();
    // Poll every 2 seconds
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [setDaemonStatus, addLog, setUIScale]);

  return (
    <MissionControl />
  );
}

export default App;
