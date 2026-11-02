import { getTranslations } from "next-intl/server";
import type { Localized } from "@/lib/content";

export const inputCls = "w-full rounded-xl border-2 border-zinc-200 bg-white px-3.5 py-2.5 text-base focus:border-brand";
export const btnCls = "rounded-xl btn-primary px-4 py-2 text-sm font-medium text-white";
export const btnGhostCls = "rounded-xl border-2 border-zinc-200 bg-white px-4 py-2 text-sm font-bold hover:border-brand";

/** Поле на трёх языках: name_ru, name_ky, name_en. Русский обязателен. */
export async function LocFields({
  name, label, value, multiline = false, requireRu = true,
}: { name: string; label: string; value?: Localized; multiline?: boolean; requireRu?: boolean }) {
  const t = await getTranslations("Admin.field");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {(["ru", "ky", "en"] as const).map((l) => (
        <label key={l} className="flex flex-col gap-1 text-xs text-zinc-500">
          {t(l)}
          {multiline ? (
            <textarea name={`${name}_${l}`} defaultValue={value?.[l] ?? ""} rows={4}
              required={requireRu && l === "ru"} className={inputCls} />
          ) : (
            <input name={`${name}_${l}`} defaultValue={value?.[l] ?? ""}
              required={requireRu && l === "ru"} className={inputCls} />
          )}
        </label>
      ))}
    </fieldset>
  );
}
