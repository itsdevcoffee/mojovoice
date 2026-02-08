interface SectionHeaderProps {
  title: string;
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {/* Animated glyph with pulse */}
      <span
        className="text-blue-500 text-sm motion-safe:animate-pulse"
        aria-hidden="true"
      >
        ▸
      </span>

      {/* Terminal-style header text */}
      <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-blue-500 font-semibold">
        {title}
      </h2>

      {/* Gradient horizontal rule */}
      <div className="flex-1 h-px bg-gradient-to-r from-blue-500 to-transparent" />
    </div>
  );
}
