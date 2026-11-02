import "server-only";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type CurrentUser, type Role } from "./auth";

/** Страница только для вошедших. Гостя отправляет на вход. */
export async function requireUser(locale: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  return user;
}

/** Страница только для указанных ролей. Остальных отправляет на их главную. */
export async function requireRole(locale: string, roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!roles.includes(user.role)) {
    return redirect({ href: user.role === "student" ? "/app" : "/admin", locale });
  }
  return user;
}
