"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {t("email")}
        <input
          name="email"
          type="email"
          defaultValue={state?.email ?? ""}
          required
          autoComplete="email"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("password")}
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {t(state.error === "throttled" ? "throttled" : "error")}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl btn-primary px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {t("submit")}
      </button>
      <Link href="/forgot" className="text-center text-sm text-zinc-600 underline">{t("forgot")}</Link>
    </form>
  );
}
