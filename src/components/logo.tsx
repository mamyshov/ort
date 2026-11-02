/** Знак платформы: облачко диалога — разговорный английский. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#2f5bff" />
      <path d="M11 13.5A3.5 3.5 0 0 1 14.5 10h11a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5H19l-5 4.5V24h-0.5A3.5 3.5 0 0 1 11 20.5z" fill="#ffcb2e" />
      <circle cx="16.5" cy="17" r="1.6" fill="#101b3d" />
      <circle cx="22.5" cy="17" r="1.6" fill="#101b3d" />
    </svg>
  );
}

export function Brand({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2.5 font-extrabold tracking-tight">
      <LogoMark />
      <span className="text-base leading-tight sm:text-lg">{name}</span>
    </span>
  );
}
