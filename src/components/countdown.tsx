"use client";

import { useEffect, useState } from "react";

/** Обратный отсчёт до срока, который задал сервер. По окончании цена на сервере уже обычная. */
export function Countdown({ deadline }: { deadline: string }) {
  const end = new Date(deadline).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  if (left === null) return <span className="font-mono">--:--:--</span>;
  const s = Math.floor(left / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="font-mono tabular-nums">{p(Math.floor(s / 3600))}:{p(Math.floor((s % 3600) / 60))}:{p(s % 60)}</span>;
}
