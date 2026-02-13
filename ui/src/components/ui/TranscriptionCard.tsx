import React, { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Card } from './Card';

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: number;
  durationMs: number;
  model: string;
  audioPath?: string;
  latencyMs?: number;
  confidenceScore?: number;
}

interface TranscriptionCardProps {
  transcription: TranscriptionEntry;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getWordCount = (text: string): number => {
  return text.trim().split(/\s+/).length;
};

const getTitleFromText = (text: string): string => {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 7).join(' ') + (words.length > 7 ? '...' : '');
};

export const TranscriptionCard: React.FC<TranscriptionCardProps> = ({
  transcription,
  onCopy,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const wordCount = getWordCount(transcription.text);
  const title = getTitleFromText(transcription.text);
  const relativeTime = formatRelativeTime(transcription.timestamp);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(transcription.text);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(transcription.id);
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="cursor-pointer transition-all duration-200 surface-texture">
        <div onClick={handleCardClick} className="relative z-10">
          {/* Header Row: Icon + Title + Metadata */}
          <div className="flex items-start gap-3 mb-2">
            <span className="text-2xl flex-shrink-0" aria-hidden="true">
              📝
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="font-mono text-base text-slate-100 mb-1 truncate pr-2">
                {title}
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <time dateTime={new Date(transcription.timestamp).toISOString()}>
                  {relativeTime}
                </time>
                <span aria-hidden="true">•</span>
                <span>{wordCount} words</span>
              </div>
            </div>
          </div>

          {/* Preview or Full Text */}
          <div className="mt-3">
            {isExpanded ? (
              <p className="font-[family-name:var(--font-ui)] text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {transcription.text}
              </p>
            ) : (
              <p className="font-[family-name:var(--font-ui)] text-sm text-slate-400 leading-relaxed line-clamp-2">
                {transcription.text}
              </p>
            )}
          </div>

          {/* Metadata Footer */}
          {(transcription.latencyMs !== undefined || transcription.confidenceScore !== undefined || transcription.model) && (
            <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex items-center gap-3 text-[11px] font-mono text-[var(--text-tertiary)]">
              {transcription.latencyMs !== undefined && (
                <span title="Inference latency">⚡ {transcription.latencyMs}ms</span>
              )}
              {transcription.confidenceScore !== undefined && (
                <span title="Confidence score">✓ {transcription.confidenceScore.toFixed(1)}%</span>
              )}
              {transcription.model && (
                <span title="Model used">{transcription.model}</span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons (shown on hover) — bottom-right */}
        {isHovered && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20">
            <button
              onClick={handleCopy}
              className="
                px-3 py-1.5
                bg-[var(--bg-elevated)]
                text-slate-300 text-xs font-mono uppercase
                border-2 border-[var(--border-default)]
                hover:bg-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:text-white
                shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
                active:translate-x-[1px] active:translate-y-[1px]
                transition-all duration-150
                flex items-center gap-1.5
              "
              aria-label="Copy transcription"
            >
              <Copy size={12} />
              <span>Copy</span>
            </button>
            <button
              onClick={handleDelete}
              className="
                px-3 py-1.5
                bg-[var(--bg-elevated)]
                text-slate-300 text-xs font-mono uppercase
                border-2 border-[var(--border-default)]
                hover:bg-[var(--error)] hover:border-[var(--error)] hover:text-white
                shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
                active:translate-x-[1px] active:translate-y-[1px]
                transition-all duration-150
                flex items-center gap-1.5
              "
              aria-label="Delete transcription"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};
