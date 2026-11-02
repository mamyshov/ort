import { redirect } from "@/i18n/navigation";

/** Старый адрес формы вебинара: теперь запись и регистрация — одна страница. */
export default async function WebinarPage({ params }: PageProps<"/[locale]/webinar">) {
  const { locale } = await params;
  return redirect({ href: "/register", locale });
}
