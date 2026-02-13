interface SectionHeaderProps {
  title: string;
  /** If provided, renders as a clickable toggle button */
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function SectionHeader({ title, isExpanded, onToggle }: SectionHeaderProps) {
  const isToggleable = onToggle !== undefined;

  const content = (
    <>
      <span
        className={`
          text-[var(--accent-primary)] text-xs leading-none
          transition-transform duration-200
          ${isToggleable && isExpanded ? 'rotate-90' : ''}
        `}
        aria-hidden="true"
      >
        ▸
      </span>
      <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent-primary)] font-semibold leading-none">
        {title}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-r from-[var(--accent-primary)] to-transparent" />
    </>
  );

  if (isToggleable) {
    return (
      <button
        onClick={onToggle}
        className="
          flex items-center gap-2 w-full text-left
          bg-transparent border-none p-0 cursor-pointer select-none
          focus-visible:outline-2 focus-visible:outline-blue-500
          focus-visible:outline-offset-2
        "
        aria-expanded={isExpanded}
        aria-label={`${title} section, ${isExpanded ? 'expanded' : 'collapsed'}. Click to ${isExpanded ? 'collapse' : 'expand'}.`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-6">
      {content}
    </div>
  );
}
