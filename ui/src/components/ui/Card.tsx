import React from 'react';

interface CardProps {
  children: React.ReactNode;
  badge?: string;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, badge, className = '' }) => {
  return (
    <div
      className={`
        relative
        p-6
        bg-[var(--bg-surface)]
        border-2 border-[var(--border-default)]
        hover:border-[var(--accent-primary)]
        hover:-translate-x-[2px] hover:-translate-y-[2px]
        hover:shadow-[var(--shadow-brutal-lift)]
        transition-all duration-150
        will-change-auto
        ${className}
      `.trim()}
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      {badge && (
        <div
          className="
            absolute top-3 right-3
            px-2 py-0.5
            bg-green-500/20
            text-green-400
            border border-green-500/50
            rounded
            text-xs
            font-mono
            uppercase
          "
        >
          {badge}
        </div>
      )}
      {children}
    </div>
  );
};
