import { getTranslations, setRequestLocale } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { ProfileForms } from "./profile-forms";

export default async function ProfilePage({ params }: PageProps<"/[locale]/app/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("App.profile");
  const [p] = await withUser(user.id, (tx) =>
    tx<{ phone: string | null }[]>`select phone from profiles where id = ${user.id}`,
  );
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm text-zinc-600">{user.email}</p>
      <ProfileForms name={user.fullName ?? ""} phone={p?.phone ?? ""} locale={user.locale} school={user.schoolLanguage ?? ""} />
    </div>
  );
}
