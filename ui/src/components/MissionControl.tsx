import { Settings as SettingsIcon } from 'lucide-react';

export default function MissionControl() {
  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-8 max-w-[800px] mx-auto">
        <h1 className="font-mono text-2xl font-bold tracking-wider text-[var(--text-primary)]">
          MOJOVOICE
        </h1>
        <button
          className="p-3 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-150"
          aria-label="Settings"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Main content area */}
      <main className="max-w-[800px] mx-auto px-6 pb-12">
        {/* Placeholder content - will be replaced in next iterations */}
        <div className="text-center py-20">
          <p className="text-[var(--text-secondary)] font-ui">
            Mission Control interface coming soon...
          </p>
        </div>
      </main>

      {/* Footer (optional - can be added later) */}
      <footer className="max-w-[800px] mx-auto px-6 py-6 text-center">
        <p className="text-xs text-[var(--text-tertiary)] font-ui">
          Press hotkey to start recording
        </p>
      </footer>
    </div>
  );
}
