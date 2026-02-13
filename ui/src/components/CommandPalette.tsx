import { Command } from 'cmdk';
import { useEffect, useRef, useState } from 'react';
import { invoke } from '../lib/ipc';

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistory: (focusSearch?: boolean) => void;
  onOpenSettings: () => void;
}

export default function CommandPalette({ isOpen, onClose, onOpenHistory, onOpenSettings }: CommandPaletteProps) {
  const [models, setModels] = useState<DownloadedModel[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      try {
        const downloaded = await invoke<DownloadedModel[]>('list_downloaded_models');
        setModels(downloaded);
      } catch (err) {
        console.error('Failed to load models:', err);
      }
    };

    loadModels();
  }, [isOpen]);

  // Focus trap + escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSwitchModel = async (filename: string) => {
    try {
      await invoke('switch_model', { filename });
      onClose();
    } catch (err) {
      console.error('Failed to switch model:', err);
    }
  };

  const handleExportHistory = async () => {
    try {
      const response = await invoke<{ entries: Array<{ text: string; timestamp: number; model: string }> }>('get_transcription_history', {
        limit: 10000,
        offset: 0,
        search: null,
        modelFilter: null,
      });

      const exportData = response.entries.map((entry) => ({
        text: entry.text,
        timestamp: entry.timestamp,
        word_count: entry.text.split(/\s+/).filter(Boolean).length,
        model_used: entry.model,
      }));

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const dateStr = new Date().toISOString().split('T')[0];
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mojovoice-history-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export history:', err);
    }
    onClose();
  };

  const handleClearHistory = async () => {
    try {
      await invoke('clear_history');
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(10,14,26,0.8)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette container */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4">
        <Command
          label="Command Palette"
          className="bg-[var(--bg-surface)] border-2 border-[var(--border-brutal)] shadow-[var(--shadow-brutal)] overflow-hidden"
        >
          <Command.Input
            placeholder="Type a command..."
            className="w-full px-5 py-4 bg-transparent text-[var(--text-primary)] font-mono text-sm border-b-2 border-[var(--border-default)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
            autoFocus
          />

          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm font-ui text-[var(--text-tertiary)]">
              No results found.
            </Command.Empty>

            {models.length > 0 && (
              <Command.Group
                heading="Models"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-[var(--accent-primary)] [&_[cmdk-group-heading]]:font-semibold"
              >
                {models.map((model) => (
                  <Command.Item
                    key={model.filename}
                    value={`switch model ${model.name}`}
                    onSelect={() => handleSwitchModel(model.filename)}
                    className="px-3 py-2.5 mx-1 flex items-center justify-between text-sm font-ui text-[var(--text-secondary)] cursor-pointer data-[selected=true]:bg-[var(--accent-primary)] data-[selected=true]:text-[var(--bg-void)] transition-colors duration-100"
                  >
                    <span>{model.name}</span>
                    <span className="text-xs font-mono opacity-60">
                      {model.isActive ? '● active' : `${model.sizeMb} MB`}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-[var(--accent-primary)] [&_[cmdk-group-heading]]:font-semibold"
            >
              <Command.Item
                value="search history"
                onSelect={() => { onClose(); onOpenHistory(true); }}
                className="px-3 py-2.5 mx-1 flex items-center justify-between text-sm font-ui text-[var(--text-secondary)] cursor-pointer data-[selected=true]:bg-[var(--accent-primary)] data-[selected=true]:text-[var(--bg-void)] transition-colors duration-100"
              >
                <span>Search History</span>
                <kbd className="text-[10px] font-mono opacity-50">⌘H</kbd>
              </Command.Item>

              <Command.Item
                value="export history"
                onSelect={handleExportHistory}
                className="px-3 py-2.5 mx-1 flex items-center justify-between text-sm font-ui text-[var(--text-secondary)] cursor-pointer data-[selected=true]:bg-[var(--accent-primary)] data-[selected=true]:text-[var(--bg-void)] transition-colors duration-100"
              >
                <span>Export History</span>
              </Command.Item>

              <Command.Item
                value="clear history"
                onSelect={handleClearHistory}
                className="px-3 py-2.5 mx-1 flex items-center justify-between text-sm font-ui text-[var(--text-secondary)] cursor-pointer data-[selected=true]:bg-[var(--error)] data-[selected=true]:text-white transition-colors duration-100"
              >
                <span>Clear History</span>
              </Command.Item>

              <Command.Item
                value="open settings preferences"
                onSelect={() => { onClose(); onOpenSettings(); }}
                className="px-3 py-2.5 mx-1 flex items-center justify-between text-sm font-ui text-[var(--text-secondary)] cursor-pointer data-[selected=true]:bg-[var(--accent-primary)] data-[selected=true]:text-[var(--bg-void)] transition-colors duration-100"
              >
                <span>Settings</span>
                <kbd className="text-[10px] font-mono opacity-50">⌘,</kbd>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t-2 border-[var(--border-default)] flex items-center gap-4 text-[10px] font-mono text-[var(--text-tertiary)]">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
