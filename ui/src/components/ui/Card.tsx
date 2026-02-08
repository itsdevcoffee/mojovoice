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
        bg-[#151B2E]
        border-2 border-[#334155]
        hover:border-[#3B82F6]
        hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]
        transition-all duration-200
        ${className}
      `.trim()}
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
