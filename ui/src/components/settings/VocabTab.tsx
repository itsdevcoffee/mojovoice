import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { invoke } from '../../lib/ipc';

interface VocabEntry {
  id: number;
  term: string;
  useCount: number;
  source: string;
  addedAt: number;
}

export default function VocabTab() {
  const { toast } = useToast();
  const [terms, setTerms] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTerm, setNewTerm] = useState('');
  const [wrongTerm, setWrongTerm] = useState('');
  const [rightTerm, setRightTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const loadTerms = async () => {
    try {
      setLoading(true);
      const data = await invoke<VocabEntry[]>('vocab_list');
      setTerms(data);
    } catch (err) {
      console.error('Failed to load vocab terms:', err);
      toast({ message: 'Failed to load vocabulary', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
    // No cleanup needed — loadTerms is a one-shot async fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    const term = newTerm.trim();
    if (!term || adding) return;
    setAdding(true);
    try {
      await invoke('vocab_add', { term, source: 'manual' });
      setNewTerm('');
      await loadTerms();
    } catch (err) {
      console.error('Failed to add vocab term:', err);
      toast({ message: `Failed to add "${term}"`, variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (term: string) => {
    try {
      await invoke('vocab_remove', { term });
      await loadTerms();
      toast({
        message: `"${term}" removed from vocabulary`,
        variant: 'undo',
        action: {
          label: 'Undo',
          onClick: async () => {
            await invoke('vocab_add', { term, source: 'manual' });
            await loadTerms();
          },
        },
      });
    } catch (err) {
      console.error('Failed to remove vocab term:', err);
      toast({ message: `Failed to remove "${term}"`, variant: 'error' });
    }
  };

  const handleCorrect = async () => {
    const wrong = wrongTerm.trim();
    const right = rightTerm.trim();
    if (!wrong || !right || correcting) return;
    setCorrecting(true);
    try {
      await invoke('vocab_correct', { wrong, right });
      setWrongTerm('');
      setRightTerm('');
      await loadTerms();
      toast({ message: `Correction recorded: "${wrong}" → "${right}"`, variant: 'success' });
    } catch (err) {
      console.error('Failed to record correction:', err);
      toast({ message: 'Failed to record correction', variant: 'error' });
    } finally {
      setCorrecting(false);
    }
  };

  const inputClass = `
    w-full px-3 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-sm placeholder:text-[var(--text-tertiary)]
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

  return (
    <div className="space-y-6">

      {/* ── TERMS ── */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-3">
          TERMS
          {terms.length > 0 && (
            <span className="ml-2 text-[var(--accent-primary)]">[{terms.length}]</span>
          )}
        </p>

        {loading ? (
          <p className="text-xs text-[var(--text-tertiary)] font-ui italic">Loading...</p>
        ) : terms.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--border-default)] p-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)] font-mono mb-1">no terms yet</p>
            <p className="text-[10px] text-[var(--text-tertiary)] font-ui">
              Add words below to bias the recognizer toward specific spellings.
            </p>
          </div>
        ) : (
          <div className="border-2 border-[var(--border-default)] divide-y divide-[var(--border-default)]">
            {terms.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors duration-100"
              >
                <span className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">
                  {entry.term}
                </span>
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  {entry.useCount}×
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono border ${
                  entry.source === 'manual'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  {entry.source}
                </span>
                <button
                  onClick={() => handleRemove(entry.term)}
                  className="shrink-0 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-500"
                  aria-label={`Remove ${entry.term}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add term input */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add a term..."
            className={inputClass}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!newTerm.trim() || adding}
          >
            Add
          </Button>
        </div>
      </div>

      {/* ── CORRECTION — vertical flow ── */}
      <div className="border-t-2 border-[var(--border-default)] pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-1">
          CORRECTION
        </p>
        <p className="text-xs text-[var(--text-tertiary)] font-ui mb-4">
          Teach the recognizer preferred spellings
        </p>

        <div className="space-y-1">
          {/* Wrong term */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              when it hears:
            </label>
            <input
              type="text"
              value={wrongTerm}
              onChange={(e) => setWrongTerm(e.target.value)}
              placeholder="misspelling or wrong word..."
              className={inputClass}
            />
          </div>

          {/* Arrow visual */}
          <div className="flex items-center justify-center py-0.5" aria-hidden="true">
            <div className="flex flex-col items-center text-[var(--accent-primary)] font-mono text-sm leading-none select-none">
              <span>│</span>
              <span>▼</span>
            </div>
          </div>

          {/* Correct term */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              it should write:
            </label>
            <input
              type="text"
              value={rightTerm}
              onChange={(e) => setRightTerm(e.target.value)}
              placeholder="correct spelling..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCorrect}
              disabled={!wrongTerm.trim() || !rightTerm.trim() || correcting}
            >
              [RECORD FIX]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
