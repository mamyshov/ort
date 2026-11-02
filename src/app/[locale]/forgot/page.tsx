import { getTranslations, setRequestLocale } from "next-intl/server";
import { btnCls, inputCls } from "@/components/loc-fields";
import { SiteShell } from "@/components/site-shell";
import { forgotAction } from "./actions";

export default async function ForgotPage({ params, searchParams }: PageProps<"/[locale]/forgot">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth.forgot");
  const email = await getTranslations("Login");
  const sent = (await searchParams).sent;
  return (
    <SiteShell>
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      {sent ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{t("sent")}</p> : (
        <form action={forgotAction} className="flex flex-col gap-4">
          <p className="text-zinc-600">{t("text")}</p>
          <label className="flex flex-col gap-1 text-sm">{email("email")}
            <input name="email" type="email" required autoComplete="email" className={inputCls} /></label>
          <button type="submit" className={btnCls}>{t("submit")}</button>
        </form>
      )}
    </SiteShell>
  );
}
