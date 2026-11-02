import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Общая оболочка публичных страниц воронки. */
export function SiteShell({ children, narrow = true }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteHeader />
      <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 ${narrow ? "max-w-lg" : "max-w-6xl"}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
