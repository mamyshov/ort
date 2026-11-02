"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { answerAction, finishAction } from "../../actions";

export type RQuestion = { id: string; passage: string; prompt: string; topic: string; options: { id: string; text: string }[] };
type Feedback = { correct: boolean; correctOption: string | null; explanation: string };

export function Runner(props: {
  attemptId: string; kind: "practice" | "mock"; questions: RQuestion[];
  initial: Record<string, string>; deadline: number | null; feedback: Record<string, Feedback>;
}) {
  const t = useTranslations("App.run");
  const locale = useLocale();
  const [i, setI] = useState(() => Math.max(0, props.questions.findIndex((q) => !props.initial[q.id])));
  const [answers, setAnswers] = useState(props.initial);
  const [fb, setFb] = useState(props.feedback);
  const [busy, startBusy] = useTransition();
  const [finishing, startFinish] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const left = props.deadline && now !== null ? Math.max(0, props.deadline - now) : null;
  const q = props.questions[i];
  const practice = props.kind === "practice";
  const answered = Object.keys(answers).length;

  useEffect(() => {
    if (!props.deadline) return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (props.deadline! - n <= 0) startFinish(() => finishAction(props.attemptId));
    };
    const first = setTimeout(tick, 0);
    const h = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(h); };
  }, [props.deadline, props.attemptId]);

  const clock = useMemo(() => {
    if (left === null) return null;
    const s = Math.floor(left / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [left]);

  function pick(optionId: string) {
    if (practice && answers[q.id]) return;
    setAnswers((a) => ({ ...a, [q.id]: optionId }));
    startBusy(async () => {
      const r = await answerAction(props.attemptId, q.id, optionId);
      if ("ok" in r && practice && r.correct !== null) {
        setFb((f) => ({ ...f, [q.id]: { correct: r.correct as boolean, correctOption: r.correctOption, explanation: r.explanation ? (r.explanation[locale as "ru" | "ky"] ?? r.explanation.ru ?? "") : "" } }));
      }
    });
  }

  const f = fb[q.id];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span>{t("progress", { n: i + 1, total: props.questions.length })} · {t("answered", { n: answered })}</span>
        {clock && <span className={`rounded-full px-3 py-1 ${left! < 60000 ? "bg-red-100 text-red-700" : "bg-brand-soft text-brand-dark"}`} role="timer">{clock}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={t("map")}>
        {props.questions.map((x, n) => (
          <button key={x.id} type="button" onClick={() => setI(n)} aria-current={n === i}
            className={`size-8 rounded-lg text-xs font-bold ${n === i ? "bg-brand text-white" : answers[x.id] ? "bg-brand-soft text-brand-dark" : "bg-white text-zinc-500"} border border-zinc-200`}>{n + 1}</button>
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-card">
        {q.topic && <p className="text-xs font-bold uppercase text-zinc-500">{q.topic}</p>}
        {q.passage && <p className="whitespace-pre-line rounded-2xl bg-zinc-100 p-4 text-sm leading-relaxed">{q.passage}</p>}
        <p className="whitespace-pre-line text-lg font-bold">{q.prompt}</p>
        <ul className="flex flex-col gap-2">
          {q.options.map((o) => {
            const chosen = answers[q.id] === o.id;
            const isRight = f?.correctOption === o.id;
            const cls = f
              ? isRight ? "border-emerald-500 bg-emerald-50" : chosen ? "border-red-500 bg-red-50" : "border-zinc-200"
              : chosen ? "border-brand bg-brand-soft" : "border-zinc-200 hover:border-brand";
            return (
              <li key={o.id}>
                <button type="button" onClick={() => pick(o.id)} disabled={practice && Boolean(answers[q.id])}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left ${cls}`}>
                  <span className="font-extrabold uppercase">{o.id}</span><span>{o.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {f && (
          <div role="status" className={`rounded-2xl p-4 text-sm ${f.correct ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
            <b>{f.correct ? t("right") : t("wrong")}</b>
            {f.explanation && <p className="mt-1 whitespace-pre-line">{f.explanation}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded-xl border-2 border-zinc-200 bg-white px-4 py-2.5 font-bold disabled:opacity-40">{t("prev")}</button>
        {i < props.questions.length - 1 ? (
          <button type="button" onClick={() => setI(i + 1)} className="rounded-xl btn-primary px-5 py-2.5 font-bold text-white">{t("next")}</button>
        ) : (
          <button type="button" disabled={finishing || busy} onClick={() => startFinish(() => finishAction(props.attemptId))} className="rounded-xl btn-primary px-5 py-2.5 font-bold text-white">{t("finish")}</button>
        )}
      </div>
      {i < props.questions.length - 1 && (
        <button type="button" disabled={finishing || busy} onClick={() => startFinish(() => finishAction(props.attemptId))} className="self-center text-sm font-bold text-zinc-500 underline">{t("finishEarly")}</button>
      )}
    </div>
  );
}
