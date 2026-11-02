"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium print:hidden">
      {label}
    </button>
  );
}
