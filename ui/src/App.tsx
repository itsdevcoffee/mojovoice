import { useEffect } from 'react';
import { invoke } from './lib/ipc';
import { useAppStore } from './stores/appStore';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import DevTools from './components/DevTools';
import Settings from './components/Settings';
import './styles/globals.css';

function App() {
  const { activeView, setDaemonStatus, addLog } = useAppStore();

  useEffect(() => {
    // Add initial log
    addLog({
      id: Date.now().toString(),
      timestamp: Date.now(),
      level: 'info',
      message: 'hyprvoice UI started',
      source: 'ui',
    });

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
  }, [setDaemonStatus, addLog]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] grid-background p-6">
      <Navigation />

      {activeView === 'dashboard' && <Dashboard />}
      {activeView === 'devtools' && <DevTools />}
      {activeView === 'history' && <PlaceholderView title="Transcription History" />}
      {activeView === 'settings' && <Settings />}
    </div>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="glass-panel p-12 text-center">
      <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-gray-400">Coming soon...</p>
    </div>
  );
}

export default App;
