import React from 'react';

export interface LoadingScannerProps {
  text?: string;
  className?: string;
}

/**
 * Loading scanner component with signature electric blue scanning animation.
 *
 * Features:
 * - Animated blue glow that scans left-to-right
 * - Monospace font for technical aesthetic
 * - 2s smooth animation cycle
 * - Respects prefers-reduced-motion
 */
export const LoadingScanner: React.FC<LoadingScannerProps> = ({
  text = 'Processing',
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="font-mono text-sm text-blue-500">{text}</span>
      <div className="relative w-32 h-1 bg-slate-700 rounded overflow-hidden">
        <div
          className="
            absolute inset-y-0 w-8
            bg-gradient-to-r from-transparent via-blue-500 to-transparent
            shadow-[0_0_12px_rgba(59,130,246,0.8)]
            animate-scan
          "
        />
      </div>
    </div>
  );
};
