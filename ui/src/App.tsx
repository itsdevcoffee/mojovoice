import { useEffect, lazy, Suspense } from 'react';
import { invoke } from './lib/ipc';
import { useAppStore } from './stores/appStore';
import { ToastProvider } from './components/ui/Toast';

// Lazy load MissionControl for code splitting
const MissionControl = lazy(() => import('./components/MissionControl'));

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
    <ToastProvider>
      {/* Skip to main content link for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-blue-600 focus:text-white focus:border-2 focus:border-black focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:font-semibold focus:uppercase focus:tracking-wide"
      >
        Skip to main content
      </a>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-[var(--bg-void)]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 font-mono text-sm">Loading...</p>
            </div>
          </div>
        }
      >
        <MissionControl />
      </Suspense>
    </ToastProvider>
  );
}

export default App;
