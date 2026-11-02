import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroBubbles } from "@/components/hero-bubbles";
import { FeatureIcon } from "@/components/feature-icon";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loc } from "@/lib/content";
import { listPackages, type PackageRow } from "@/lib/payments";

type Step = { t: string; d: string };
type Feature = { i: string; t: string; d: string };
type Faq = { q: string; a: string };
type Goal = { i: string; t: string; d: string };
const GOAL_ICON: Record<string, string> = { chat: "💬", work: "💼", exam: "🎓" };
const GOAL_BG = ["bg-coral", "bg-lilac", "bg-sky"];
const GUARANTEE_ICON = ["📊", "🤖", "🏅"];

/** Ссылка на видео принимается только с проверенных видеосервисов. */
function videoSrc(): string | null {
  const v = process.env.HOME_VIDEO_URL?.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    const ok = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "iframe.mediadelivery.net"];
    return u.protocol === "https:" && ok.includes(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const steps = t.raw("how.steps") as Step[];
  const features = t.raw("features.items") as Feature[];
  const faq = t.raw("faq.items") as Faq[];
  const goals = t.raw("goals.items") as Goal[];
  const guarantees = t.raw("guarantees") as string[];
  let packages: PackageRow[] = [];
  try { packages = await listPackages(false); } catch { packages = []; }
  const showReviewsStub = process.env.DEMO_MODE === "1";
  const video = videoSrc();
  const cta = "rounded-full bg-sun px-7 py-3.5 font-extrabold text-ink shadow-[0_4px_0_0_#d9a800] active:translate-y-[3px] active:shadow-none";

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pb-20 pt-4 sm:gap-24 sm:px-6">
        <div className="flex flex-col">
          <section className="relative overflow-hidden rounded-t-[2rem] bg-brand p-6 text-white sm:p-12 md:rounded-t-[2.5rem]">
            <div className="grid items-center gap-8 md:grid-cols-[1.7fr_1fr]">
              <div className="flex flex-col gap-6">
                <span className="w-fit rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold">{t("badge")}</span>
                <h1 className="text-balance text-[1.9rem] font-bold leading-[1.1] sm:text-5xl lg:text-[3.25rem]">{t("title")}</h1>
                <p className="max-w-lg text-lg text-white/85">{t("subtitle")}</p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/register" className={cta}>{t("webinar")}</Link>
                  <Link href="/level-test" className="rounded-full border-2 border-white/40 px-7 py-3.5 font-extrabold text-white hover:bg-white/10">{t("levelCta")}</Link>
                </div>
              </div>
              <HeroBubbles />
            </div>
          </section>
          <ul className="grid gap-3 rounded-b-[2rem] bg-sun p-5 text-ink sm:grid-cols-3 sm:gap-6 sm:px-10 sm:py-6 md:rounded-b-[2.5rem]">
            {guarantees.map((g, i) => (
              <li key={g} className="flex items-center gap-3 font-extrabold">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60 text-xl">{GUARANTEE_ICON[i]}</span>{g}
              </li>
            ))}
          </ul>
        </div>

        <section id="goals" className="flex scroll-mt-24 flex-col gap-8">
          <div className="flex flex-col gap-3 text-center sm:items-center">
            <h2 className="text-4xl font-bold sm:text-5xl">{t("goals.title")}</h2>
            <p className="max-w-xl text-zinc-600">{t("goals.text")}</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {(goals as Goal[]).map((g, i) => (
              <li key={g.t}>
                <Link href="/level-test" className={`flex h-full flex-col gap-3 rounded-[1.75rem] p-6 text-ink transition hover:-translate-y-1 ${GOAL_BG[i % 3]}`}>
                  <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl bg-white/60 text-4xl">{GOAL_ICON[g.i]}</span>
                  <h3 className="font-serif text-2xl font-bold">{g.t}</h3>
                  <p className="flex-1 font-semibold text-ink/80">{g.d}</p>
                  <span className="font-extrabold">{t("goals.cta")} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="flex scroll-mt-24 flex-col gap-8">
          <h2 className="text-4xl font-bold sm:text-5xl">{t("how.title")}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="flex flex-col gap-3 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-card">
                <span className="flex size-12 items-center justify-center rounded-full bg-sun font-serif text-2xl font-bold text-ink">{i + 1}</span>
                <h3 className="text-xl font-extrabold">{s.t}</h3>
                <p className="text-zinc-600">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {video && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-4xl font-bold sm:text-5xl">{t("video.title")}</h2>
              <p className="max-w-xl text-zinc-600">{t("video.text")}</p>
            </div>
            <div className="aspect-video overflow-hidden rounded-[1.75rem] bg-ink shadow-card">
              <iframe src={video} title={t("video.title")} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
            </div>
          </section>
        )}

        <section className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-[2rem] bg-sun-soft px-6 py-14 text-center">
          <p className="font-serif text-5xl font-bold sm:text-7xl">{t("big.a")}</p>
          <p className="font-serif text-3xl font-semibold text-brand sm:text-5xl">{t("big.b")}</p>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-4xl font-bold sm:text-5xl">{t("features.title")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <li key={f.t} className="flex flex-col gap-3 rounded-[1.75rem] bg-white p-6 ring-1 ring-zinc-200">
                <span className={`flex size-12 items-center justify-center rounded-2xl text-ink ${["bg-mint", "bg-sky", "bg-lilac", "bg-sun", "bg-coral", "bg-brand-soft"][i % 6]}`}><FeatureIcon name={f.i} /></span>
                <h3 className="text-lg font-extrabold">{f.t}</h3>
                <p className="text-zinc-600">{f.d}</p>
              </li>
            ))}
          </ul>
        </section>

        {packages.length > 0 && (
          <section id="prices" className="flex scroll-mt-24 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-4xl font-bold sm:text-5xl">{t("packages.title")}</h2>
              <p className="max-w-xl text-zinc-600">{t("packages.text")}</p>
            </div>
            <ul className="grid items-end gap-4 md:grid-cols-2">
              {packages.map((p, i) => (
                <li key={p.id} className={`flex flex-col gap-4 rounded-[1.75rem] bg-white p-6 shadow-card ${i === packages.length - 1 ? "border-2 border-brand md:pb-10" : "border border-zinc-200"}`}>
                  <h3 className="text-xl font-extrabold">{loc(p.title, locale)}</h3>
                  <div className="flex flex-col gap-0.5">
                    {p.listPriceUsd != null && (
                      <span className="text-sm text-zinc-500">{t("packages.regular")}: <s className="font-bold">${p.listPriceUsd}</s></span>
                    )}
                    <span className="font-serif text-5xl font-bold text-brand">${p.priceUsd}</span>
                    {p.listPriceUsd != null && <span className="mt-1 w-fit rounded-full bg-sun-soft px-3 py-0.5 text-xs font-extrabold text-ink">{t("packages.webinar")}</span>}
                  </div>
                  {p.courses.length > 0 && (
                    <div className="flex flex-col gap-1.5 text-sm">
                      <span className="font-bold text-zinc-500">{t("packages.includes")}</span>
                      <ul className="flex flex-col gap-1">
                        {p.courses.map((c, j) => <li key={j} className="flex gap-2"><span aria-hidden="true" className="text-brand">✓</span>{loc(c, locale)}</li>)}
                      </ul>
                    </div>
                  )}
                  <Link href="/register" className="btn-primary mt-auto px-5 py-3 text-center">{t("packages.cta")}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showReviewsStub && (
          <section className="flex flex-col gap-4">
            <h2 className="text-4xl font-bold sm:text-5xl">{t("reviews.title")}</h2>
            <p className="rounded-[1.75rem] border-2 border-dashed border-zinc-300 bg-white p-6 text-zinc-500">{t("reviews.placeholder")}</p>
          </section>
        )}

        <section className="flex flex-col items-start gap-4 rounded-[2rem] bg-mint p-6 text-ink sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="text-3xl font-bold sm:text-4xl">{t("level.title")}</h2>
            <p className="font-semibold text-ink/80">{t("level.text")}</p>
          </div>
          <Link href="/level-test" className="shrink-0 rounded-full bg-ink px-7 py-3.5 font-extrabold text-white shadow-[0_4px_0_0_#000] active:translate-y-[3px] active:shadow-none">{t("levelCta")}</Link>
        </section>

        <section id="faq" className="mx-auto flex w-full max-w-3xl scroll-mt-24 flex-col gap-6">
          <h2 className="text-4xl font-bold sm:text-5xl">{t("faq.title")}</h2>
          <div className="flex flex-col gap-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-zinc-200 bg-white p-5 open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-extrabold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sun-soft text-ink transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-zinc-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 rounded-[2rem] bg-ink p-8 text-center text-white sm:p-14">
          <h2 className="text-4xl font-bold sm:text-5xl">{t("final.title")}</h2>
          <p className="max-w-md text-white/75">{t("final.text")}</p>
          <Link href="/register" className={`${cta} text-lg`}>{t("webinar")}</Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
