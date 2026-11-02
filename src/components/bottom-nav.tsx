"use client";

import { Link, usePathname } from "@/i18n/navigation";

const icons: Record<string, React.ReactNode> = {
  courses: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3" /></>,
  practice: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />,
  mock: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 2M9.5 3h5" /></>,
  history: <path d="M5 20V10M12 20V4M19 20v-7" />,
  profile: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
};

export type NavItem = { key: keyof typeof icons; href: string; label: string };

/** Нижняя панель для телефона: главные разделы всегда под большим пальцем. */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md justify-around">
        {items.map((it) => {
          const active = it.href === "/app" ? path === "/app" : path.startsWith(it.href);
          return (
            <li key={it.key} className="flex-1">
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-bold ${active ? "text-brand" : "text-zinc-500"}`}>
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-brand-soft" : ""}`}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[it.key]}</svg>
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
