import "server-only";
import { createHash } from "node:crypto";
import { withUser } from "./db";
import type { Localized } from "./content";

export type RawOption = string | Localized;

/** Формат загрузки вопросов (JSON, один объект на вопрос). */
export type ImportItem = {
  section: string;                     // slug раздела: main, kyrgyz, russian, ...
  topic?: string | Localized | null;   // название темы; если такой нет, будет создана
  passage?: Localized | string | null; // текст для чтения
  prompt: Localized | string;
  options: RawOption[];                // 2–6 вариантов, ids a, b, c...
  correct?: string | number | null;    // "a"/"б"/индекс с 0; без него вопрос остаётся черновиком
  explanation?: Localized | string | null;
  difficulty?: 1 | 2 | 3;
  free?: boolean;
  lang?: "ru" | "ky";                  // на каком языке тексты, если заданы строкой
};

const LATIN_TO_CYR: Record<string, string> = { a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у" };

const unify = (s: string) => s.toLowerCase()
  .replace(/^\s*\(?[a-zа-яөүң]\)\s*/iu, "")        // «(А) » в начале варианта
  .replace(/[«»„“”"]/g, '"').replace(/[‐‑–—−]/g, "-")  // разные кавычки и тире считаем одинаковыми
  .replace(/[a-z]/g, (c) => LATIN_TO_CYR[c] ?? c)    // латинские буквы-двойники в кириллицу
  .replace(/\s+/g, " ").trim();

/**
 * Строгий вид текста для поиска точных повторов: регистр, пробелы, тип кавычек и тире не важны,
 * а знаки препинания, дефисы и звёздочки ВАЖНЫ. В вопросах по орфографии и пунктуации варианты
 * различаются именно ими («жан-жаныбар» и «жан жаныбар» — разные ответы).
 */
export const normalizeText = (s: string): string => unify(s).replace(/\s*([,.;:!?()-])\s*/g, "$1");

/** Грубый вид без знаков: по нему находим похожие вопросы, которые стоит проверить глазами. */
export const looseText = (s: string): string => unify(s).replace(/[\p{P}\p{S}\s]+/gu, "");

const pickText = (v: Localized | string | null | undefined, lang: "ru" | "ky"): Localized =>
  !v ? {} : typeof v === "string" ? { [lang]: v.trim() } : Object.fromEntries(Object.entries(v).filter(([, t]) => t?.trim()).map(([k, t]) => [k, t!.trim()]));

const firstText = (v: Localized) => v.ky || v.ru || Object.values(v)[0] || "";

const sha = (parts: string[]) => createHash("sha256").update(parts.join("|")).digest("hex");

function fingerprints(prompt: Localized, options: Localized[], passage?: Localized | null) {
  const mk = (n: (s: string) => string) => sha([n(firstText(passage ?? {})), n(firstText(prompt)), ...options.map((o) => n(firstText(o))).sort()]);
  return { strict: mk(normalizeText), loose: mk(looseText) };
}

export const fingerprint = (prompt: Localized, options: Localized[], passage?: Localized | null) => fingerprints(prompt, options, passage);

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"];
const LETTERS: Record<string, string> = { а: "a", б: "b", в: "c", г: "d", д: "e", a: "a", b: "b", c: "c", d: "d", e: "e", f: "f" };

function resolveCorrect(c: ImportItem["correct"], n: number): string | null {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") return c >= 0 && c < n ? OPTION_IDS[c] : null;
  const id = LETTERS[c.trim().toLowerCase()];
  return id && OPTION_IDS.indexOf(id) < n ? id : null;
}

export type ImportReport = {
  added: number; published: number; drafts: number;
  duplicates: { index: number; prompt: string }[];
  /** Загружены, но очень похожи на уже имеющиеся (отличаются знаками): проверьте вручную */
  similar: { index: number; prompt: string }[];
  errors: { index: number; message: string }[];
};

/** Загрузка пачки вопросов. Повторы (по тексту вопроса и вариантов) пропускаются. Только владелец: проверяет база. */
export async function importQuestions(staffId: string, items: ImportItem[], opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const report: ImportReport = { added: 0, published: 0, drafts: 0, duplicates: [], similar: [], errors: [] };
  await withUser(staffId, async (tx) => {
    const sections = await tx<{ id: string; slug: string }[]>`select id, slug from sections`;
    const seenInBatch = new Set<string>();
    const looseInBatch = new Set<string>();
    for (const [index, it] of items.entries()) {
      try {
        await tx`savepoint item`;
        const lang = it.lang ?? "ru";
        const section = sections.find((s) => s.slug === it.section);
        if (!section) { report.errors.push({ index, message: `нет раздела «${it.section}»` }); continue; }
        const prompt = pickText(it.prompt, lang);
        const options = (it.options ?? []).map((o) => pickText(o, lang));
        if (!firstText(prompt) || options.length < 2 || options.length > 6 || options.some((o) => !firstText(o))) {
          report.errors.push({ index, message: "нужен текст вопроса и от 2 до 6 непустых вариантов" }); continue;
        }
        const passage = it.passage ? pickText(it.passage, lang) : null;
        const { strict: fp, loose } = fingerprint(prompt, options, passage);
        if (seenInBatch.has(fp)) { report.duplicates.push({ index, prompt: firstText(prompt) }); continue; }
        seenInBatch.add(fp);
        const [dup] = await tx`select 1 from questions where fingerprint = ${fp}`;
        if (dup) { report.duplicates.push({ index, prompt: firstText(prompt) }); continue; }
        const [sim] = await tx`select 1 from questions where loose_fp = ${loose}`;
        if (sim || looseInBatch.has(loose)) report.similar.push({ index, prompt: firstText(prompt) });
        looseInBatch.add(loose);
        const correct = resolveCorrect(it.correct, options.length);
        if (it.correct !== undefined && it.correct !== null && it.correct !== "" && !correct) {
          report.errors.push({ index, message: "правильный ответ не соответствует вариантам" }); continue;
        }
        report.added++;
        if (correct) report.published++; else report.drafts++;
        if (opts.dryRun) continue;

        let topicId: string | null = null;
        if (it.topic) {
          const tt = pickText(it.topic, lang);
          const [ex] = await tx<{ id: string }[]>`
            select id from topics where section_id = ${section.id} and (title ->> 'ru' = ${tt.ru ?? ""} or title ->> 'ky' = ${tt.ky ?? ""})`;
          topicId = ex?.id ?? (await tx<{ id: string }[]>`
            insert into topics (section_id, title, position) values (${section.id}, ${tx.json(tt)},
              (select coalesce(max(position), 0) + 1 from topics where section_id = ${section.id})) returning id`)[0].id;
        }
        const [q] = await tx<{ id: string }[]>`
          insert into questions (section_id, topic_id, passage, prompt, options, difficulty, is_free, is_published, fingerprint, loose_fp)
          values (${section.id}, ${topicId}, ${passage ? tx.json(passage) : null}, ${tx.json(prompt)},
                  ${tx.json(options.map((text, i) => ({ id: OPTION_IDS[i], text })))},
                  ${it.difficulty ?? 2}, ${it.free ?? false}, false, ${fp}, ${loose})
          returning id`;
        if (correct) {
          await tx`insert into question_keys (question_id, correct_option, explanation)
                   values (${q.id}, ${correct}, ${tx.json(pickText(it.explanation, lang))})`;
          await tx`update questions set is_published = true where id = ${q.id}`;
        }
        await tx`release savepoint item`;
      } catch (e) {
        await tx`rollback to savepoint item`.catch(() => {});
        report.errors.push({ index, message: e instanceof Error ? e.message : "ошибка" });
      }
    }
    if (!opts.dryRun) {
      await tx`insert into audit_log (actor_id, action, entity, data)
               values (${staffId}, 'questions.import', 'question', ${tx.json({ added: report.added, drafts: report.drafts, duplicates: report.duplicates.length })})`;
    }
  });
  return report;
}

/** Разбор CSV: section;topic;prompt_ru;prompt_ky;a_ru;a_ky;b_ru;... Простой формат для Excel. */
export function parseCsv(text: string): ImportItem[] {
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", q = false;
  const delim = text.split("\n")[0].includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { cur.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; cur.push(cell); cell = ""; if (cur.some((x) => x.trim())) rows.push(cur); cur = []; }
    else cell += c;
  }
  cur.push(cell); if (cur.some((x) => x.trim())) rows.push(cur);
  const head = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (r: string[], name: string) => (r[head.indexOf(name)] ?? "").trim();
  return rows.map((r) => {
    const options: Localized[] = [];
    for (const id of OPTION_IDS) {
      const o = { ru: col(r, `${id}_ru`), ky: col(r, `${id}_ky`) };
      if (o.ru || o.ky) options.push(Object.fromEntries(Object.entries(o).filter(([, v]) => v)));
    }
    const lc = (base: string): Localized => Object.fromEntries((["ru", "ky"] as const).map((l) => [l, col(r, `${base}_${l}`)]).filter(([, v]) => v));
    const topic = lc("topic");
    return {
      section: col(r, "section"), topic: Object.keys(topic).length ? topic : null, prompt: lc("prompt"),
      passage: Object.keys(lc("passage")).length ? lc("passage") : null, options,
      correct: col(r, "correct") || null, explanation: lc("explanation"),
      difficulty: ([1, 2, 3].includes(Number(col(r, "difficulty"))) ? Number(col(r, "difficulty")) : 2) as 1 | 2 | 3,
      free: ["1", "true", "да", "yes"].includes(col(r, "free").toLowerCase()),
    };
  });
}
