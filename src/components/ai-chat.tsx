"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ChatState } from "@/app/[locale]/ai/actions";

export function AiChat({
  action, placeholder, title, extra,
}: { action: (s: ChatState, fd: FormData) => Promise<ChatState>; placeholder: string; title?: string; extra?: Record<string, string> }) {
  const t = useTranslations("Ai");
  const [state, run, pending] = useActionState<ChatState, FormData>(action, { history: [] });
  const key = `ai-chat:${usePathname()}`;
  const [restored, setRestored] = useState<ChatState["history"]>([]);
  const history = state.history.length ? state.history : restored;
  const end = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) setRestored(JSON.parse(saved)); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
  }, [key]);
  useEffect(() => {
    if (!state.history.length) return;
    try { sessionStorage.setItem(key, JSON.stringify(state.history.slice(-30))); } catch {}
  }, [state.history, key]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); if (!state.error) form.current?.reset(); }, [state]);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white shadow-card p-4">
      {title && <h2 className="font-extrabold">{title}</h2>}
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {history.map((m, i) => (
          <p key={i} className={`whitespace-pre-line rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "self-end bg-brand text-white" : "self-start bg-zinc-100"}`}>
            {m.content}
          </p>
        ))}
        {pending && <p className="text-sm text-zinc-500">{t("thinking")}</p>}
        <div ref={end} />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{t(`err.${state.error}` as "err.error")}</p>}
      <form ref={form} action={run} className="flex gap-2">
        <input type="hidden" name="history" value={JSON.stringify(history)} />
        {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name="message" required maxLength={1000} placeholder={placeholder} autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base" />
        <button type="submit" disabled={pending} className="rounded-xl btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{t("send")}</button>
      </form>
      <p className="text-xs text-zinc-500">{t("label")}{state.mock && ` · ${t("mock")}`}</p>
    </section>
  );
}
