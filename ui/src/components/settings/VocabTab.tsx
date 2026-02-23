import { X } from 'lucide-react';
import { Button } from '../ui/Button';

interface VocabTerm {
  id: number;
  term: string;
  useCount: number;
  source: string;
  addedAt: number;
}

interface VocabTabProps {
  vocabTerms: VocabTerm[];
  vocabLoading: boolean;
  newTerm: string;
  wrongTerm: string;
  rightTerm: string;
  onNewTermChange: (v: string) => void;
  onWrongTermChange: (v: string) => void;
  onRightTermChange: (v: string) => void;
  onVocabAdd: () => void;
  onVocabRemove: (term: string) => void;
  onVocabCorrect: () => void;
}

export default function VocabTab({
  vocabTerms,
  vocabLoading,
  newTerm,
  wrongTerm,
  rightTerm,
  onNewTermChange,
  onWrongTermChange,
  onRightTermChange,
  onVocabAdd,
  onVocabRemove,
  onVocabCorrect,
}: VocabTabProps) {
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
          {vocabTerms.length > 0 && (
            <span className="ml-2 text-[var(--accent-primary)]">[{vocabTerms.length}]</span>
          )}
        </p>

        {vocabLoading ? (
          <p className="text-xs text-[var(--text-tertiary)] font-ui italic">Loading...</p>
        ) : vocabTerms.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--border-default)] p-4 text-center">
            <p className="text-xs text-[var(--text-tertiary)] font-mono italic">no terms yet</p>
          </div>
        ) : (
          <div className="border-2 border-[var(--border-default)] divide-y divide-[var(--border-default)]">
            {vocabTerms.map((vocabTerm) => (
              <div
                key={vocabTerm.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors duration-100"
              >
                <span className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">
                  {vocabTerm.term}
                </span>
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  {vocabTerm.useCount}×
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono border ${
                  vocabTerm.source === 'manual'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  {vocabTerm.source}
                </span>
                <button
                  onClick={() => onVocabRemove(vocabTerm.term)}
                  className="shrink-0 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-500"
                  aria-label={`Remove ${vocabTerm.term}`}
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
            onChange={(e) => onNewTermChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onVocabAdd()}
            placeholder="Add a term..."
            className={inputClass}
          />
          <Button variant="primary" size="sm" onClick={onVocabAdd} disabled={!newTerm.trim()}>
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
              onChange={(e) => onWrongTermChange(e.target.value)}
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
              onChange={(e) => onRightTermChange(e.target.value)}
              placeholder="correct spelling..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onVocabCorrect}
              disabled={!wrongTerm.trim() || !rightTerm.trim()}
            >
              [RECORD FIX]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
