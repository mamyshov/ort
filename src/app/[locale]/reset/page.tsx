import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { btnCls, inputCls } from "@/components/loc-fields";
import { SiteShell } from "@/components/site-shell";
import { resetAction } from "./actions";

export default async function ResetPage({ params, searchParams }: PageProps<"/[locale]/reset">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth.reset");
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (sp.done) {
    return (
      <SiteShell>
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{t("done")}</p>
        <Link href="/login" className={`${btnCls} text-center`}>{t("login")}</Link>
      </SiteShell>
    );
  }
  return (
    <SiteShell>
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      {sp.error && <p role="alert" className="text-sm text-red-600">{t("invalid")}</p>}
      <form action={resetAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <label className="flex flex-col gap-1 text-sm">{t("password")}
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></label>
        <button type="submit" className={btnCls}>{t("submit")}</button>
      </form>
    </SiteShell>
  );
}
