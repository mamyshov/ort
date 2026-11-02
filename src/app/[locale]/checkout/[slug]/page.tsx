import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FbPixel } from "@/components/fb-pixel";
import { btnCls, inputCls } from "@/components/loc-fields";
import { SiteShell } from "@/components/site-shell";
import { loc } from "@/lib/content";
import { getCurrentUser } from "@/lib/auth";
import { isChildOf, listChildren } from "@/lib/children";
import { currentLead } from "@/lib/funnel";
import { availableMethods, getPackage, priceFor } from "@/lib/payments";
import { checkoutAction } from "../actions";

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[locale]/checkout/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const pkg = await getPackage(slug);
  if (!pkg) notFound();
  const t = await getTranslations("Funnel.checkout");
  const tm = await getTranslations("Funnel.method");
  const lead = await currentLead();
  const me = await getCurrentUser();
  const tc = await getTranslations("Children");
  if (me?.guardianId) {
    return <SiteShell><h1 className="text-2xl font-extrabold">{t("title")}</h1><p className="rounded-2xl bg-sun-soft p-4 font-bold">{tc("askParent")}</p></SiteShell>;
  }
  const childId = String((await searchParams).child ?? "");
  const forChild = me && childId && (await isChildOf(me.id, childId)) ? childId : null;
  const childName = forChild ? (await listChildren(me!.id)).find((c) => c.id === forChild)?.fullName : null;
  const price = priceFor(pkg, lead?.created_at ?? null);
  const methods = availableMethods();
  const failed = (await searchParams).error;
  return (
    <SiteShell>
      <FbPixel event="InitiateCheckout" value={price} />
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <div className="flex items-baseline justify-between rounded-3xl border border-zinc-200 bg-white shadow-card p-4">
        <span className="font-medium">{loc(pkg.title, locale)}</span>
        <span>{t("total")}: <b className="text-xl">${price}</b></span>
      </div>
      {failed && <p role="alert" className="text-sm text-red-600">{t("error")}</p>}
      {methods.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">{t("noMethods")}</p>
      ) : (
        <form action={checkoutAction} className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white shadow-card p-5">
          <input type="hidden" name="slug" value={pkg.slug} />
          {forChild && <input type="hidden" name="childId" value={forChild} />}
          {childName && <p className="rounded-xl bg-sky/40 p-3 text-sm font-bold">{tc("buyingFor", { name: childName })}</p>}
          <label className="flex flex-col gap-1 text-sm">{t("name")}
            <input name="name" required minLength={2} defaultValue={me?.fullName ?? lead?.name ?? ""} autoComplete="name" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm">{t("email")}
            <input name="email" type="email" required defaultValue={me?.email ?? lead?.email ?? ""} autoComplete="email" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm">{t("phone")}
            <input name="phone" type="tel" required defaultValue={lead?.phone ?? ""} autoComplete="tel" className={inputCls} /></label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm">{t("method")}</legend>
            {methods.map((m, i) => (
              <label key={m.method} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3">
                <input type="radio" name="method" value={m.method} required defaultChecked={i === 0} />
                {tm(m.method)}
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="terms" required className="mt-1" />
            <span>{t("terms")} (<Link href="/terms" className="underline">{t("termsLink")}</Link>)</span>
          </label>
          <button type="submit" className={btnCls}>{t("pay")}</button>
        </form>
      )}
    </SiteShell>
  );
}
