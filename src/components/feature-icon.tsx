const paths: Record<string, React.ReactNode> = {
  video: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" stroke="none" /></>,
  chat: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" /><path d="M9 9.5h6M9 12h3.5" /></>,
  cards: <><rect x="3.5" y="7" width="13" height="12" rx="2.5" /><path d="M7.5 4.5h11A2 2 0 0 1 20.5 6.5V16" /></>,
  plan: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3.5v3M16 3.5v3M4 10h16M8.5 14.5l2 2 4-4" /></>,
  exam: <><path d="M7 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M9 12.5l2 2 4-4" /></>,
  cert: <><circle cx="12" cy="9.5" r="5.5" /><path d="m9 14.5-1.5 6 4.5-2.5 4.5 2.5-1.5-6" /></>,
};

export function FeatureIcon({ name }: { name: string }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {paths[name] ?? paths.video}
      </svg>
    </span>
  );
}
