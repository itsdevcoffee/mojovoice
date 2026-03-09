import { useState } from 'react';
import SettingsConfigTab from './settings/SettingsConfigTab';
import VocabTab from './settings/VocabTab';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'settings' | 'vocab'>('settings');

  const tabs = ['settings', 'vocab'] as const;

  return (
    <div>
      {/* Two-tab bar */}
      <div
        className="flex mb-6"
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={(e) => {
          const currentIndex = tabs.indexOf(activeTab);
          if (e.key === 'ArrowRight') {
            const next = tabs[(currentIndex + 1) % tabs.length];
            setActiveTab(next);
            document.getElementById(`tab-${next}`)?.focus();
          } else if (e.key === 'ArrowLeft') {
            const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
            setActiveTab(prev);
            document.getElementById(`tab-${prev}`)?.focus();
          }
        }}
      >
        {(['settings', 'vocab'] as const).map((tab, i) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
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
            {tab === 'settings' ? '[SETTINGS]' : '[VOCAB]'}
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
        {activeTab === 'settings' && <SettingsConfigTab />}
      </div>

      {/* VOCAB tab panel */}
      <div
        id="tabpanel-vocab"
        role="tabpanel"
        aria-labelledby="tab-vocab"
        hidden={activeTab !== 'vocab'}
      >
        {activeTab === 'vocab' && <VocabTab />}
      </div>
    </div>
  );
}
