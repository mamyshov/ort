"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUser, isStaff, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/admin";
import { withUser, type Tx } from "@/lib/db";

const LANGS = ["ru", "ky", "en"] as const;
const UUID = /^[0-9a-f-]{36}$/i;

async function staff(): Promise<CurrentUser | null> {
  const u = await getCurrentUser();
  return u && isStaff(u.role) ? u : null;
}

/** Читает поля вида title_ru, title_ky, title_en. Пустые языки отбрасываются. */
function readLoc(fd: FormData, name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LANGS) {
    const v = String(fd.get(`${name}_${l}`) ?? "").trim().slice(0, 20000);
    if (v) out[l] = v;
  }
  return out;
}

const id = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "");
  return UUID.test(v) ? v : null;
};

/** Общий каркас: проверка входа, транзакция от имени пользователя (правила базы), журнал. */
async function run(fn: (tx: Tx, u: CurrentUser) => Promise<void>, paths: string[]) {
  const u = await staff();
  if (!u) return false;
  try {
    await withUser(u.id, (tx) => fn(tx, u));
  } catch {
    return false;
  }
  for (const p of paths) revalidatePath(p, "page");
  return true;
}

async function back(path: string, ok: boolean) {
  const locale = await getLocale();
  redirect({ href: ok ? path : `${path}${path.includes("?") ? "&" : "?"}error=1`, locale });
}

export async function createCourseAction(fd: FormData) {
  const title = readLoc(fd, "title");
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  let newId = "";
  const ok = !!title.ru && /^[a-z0-9-]{2,60}$/.test(slug) && await run(async (tx, u) => {
    const [c] = await tx<{ id: string }[]>`
      insert into courses (slug, title, description) values (${slug}, ${tx.json(title)}, ${tx.json(readLoc(fd, "description"))})
      returning id`;
    newId = c.id;
    await audit(tx, u.id, "course.create", "course", c.id, { slug });
  }, ["/admin/courses"]);
  await back(ok ? `/admin/courses/${newId}` : "/admin/courses", ok);
}

export async function updateCourseAction(fd: FormData) {
  const cid = id(fd, "id");
  const title = readLoc(fd, "title");
  const path = `/admin/courses/${cid}`;
  const ok = !!cid && !!title.ru && await run(async (tx, u) => {
    const published = fd.get("published") === "on";
    const a = String(fd.get("audience") ?? "all");
    const audience = ["all", "kids", "teens", "adults"].includes(a) ? a : "all";
    const r = await tx`
      update courses set title = ${tx.json(title)}, description = ${tx.json(readLoc(fd, "description"))},
             is_published = ${published}, audience = ${audience} where id = ${cid} returning id`;
    if (r.length === 0) throw new Error("denied");
    await audit(tx, u.id, "course.update", "course", cid, { published });
  }, [path]);
  await back(path, ok);
}

export async function addModuleAction(fd: FormData) {
  const cid = id(fd, "courseId");
  const title = readLoc(fd, "title");
  const path = `/admin/courses/${cid}`;
  const ok = !!cid && !!title.ru && await run(async (tx, u) => {
    const [m] = await tx<{ id: string }[]>`
      insert into modules (course_id, position, title)
      values (${cid}, coalesce((select max(position) from modules where course_id = ${cid}), 0) + 1, ${tx.json(title)})
      returning id`;
    await audit(tx, u.id, "module.create", "module", m.id, { courseId: cid });
  }, [path]);
  await back(path, ok);
}

export async function addLessonAction(fd: FormData) {
  const mid = id(fd, "moduleId");
  const cid = id(fd, "courseId");
  const title = readLoc(fd, "title");
  const path = `/admin/courses/${cid}`;
  let lessonId = "";
  const ok = !!mid && !!cid && !!title.ru && await run(async (tx, u) => {
    const [l] = await tx<{ id: string }[]>`
      insert into lessons (module_id, position, title, kind)
      values (${mid}, coalesce((select max(position) from lessons where module_id = ${mid}), 0) + 1, ${tx.json(title)}, 'video')
      returning id`;
    lessonId = l.id;
    await audit(tx, u.id, "lesson.create", "lesson", l.id, { moduleId: mid });
  }, [path]);
  await back(ok ? `/admin/lessons/${lessonId}` : path, ok);
}

export async function updateLessonAction(fd: FormData) {
  const lid = id(fd, "id");
  const title = readLoc(fd, "title");
  const kind = String(fd.get("kind") ?? "");
  const exam = kind === "exam" ? String(fd.get("exam") ?? "") : null;
  const provider = String(fd.get("provider") ?? "") || null;
  const videoRef = String(fd.get("videoRef") ?? "").trim().slice(0, 200) || null;
  const pass = Number(fd.get("passScore"));
  const path = `/admin/lessons/${lid}`;
  const valid =
    !!lid && !!title.ru && ["video", "text", "exam"].includes(kind) &&
    (kind !== "exam" || ["quiz", "assignment"].includes(exam ?? "")) &&
    (provider === null || ["bunny", "youtube", "vimeo"].includes(provider));
  const ok = valid && await run(async (tx, u) => {
    const content = { body: readLoc(fd, "body"), prompt: readLoc(fd, "prompt") };
    const passScore = kind === "exam" && exam === "quiz" && Number.isInteger(pass) && pass >= 0 && pass <= 100 ? pass : null;
    const r = await tx`
      update lessons set title = ${tx.json(title)}, kind = ${kind}, exam = ${exam},
             video_provider = ${kind === "video" ? provider : null},
             video_ref = ${kind === "video" && provider ? videoRef : null},
             content = ${tx.json(content)}, pass_score = ${passScore}
      where id = ${lid} returning id`;
    if (r.length === 0) throw new Error("denied");
    await audit(tx, u.id, "lesson.update", "lesson", lid, { kind, exam });
  }, [path]);
  await back(path, ok);
}

export async function deleteLessonAction(fd: FormData) {
  const lid = id(fd, "id");
  const cid = id(fd, "courseId");
  const path = `/admin/courses/${cid}`;
  const ok = !!lid && !!cid && await run(async (tx, u) => {
    const r = await tx`delete from lessons where id = ${lid} returning id`;
    if (r.length === 0) throw new Error("denied");
    await audit(tx, u.id, "lesson.delete", "lesson", lid);
  }, [path]);
  await back(path, ok);
}

export async function assignTeacherAction(fd: FormData) {
  const cid = id(fd, "courseId");
  const tid = id(fd, "teacherId");
  const remove = fd.get("remove") === "1";
  const path = `/admin/courses/${cid}`;
  const ok = !!cid && !!tid && await run(async (tx, u) => {
    if (remove) await tx`delete from course_teachers where course_id = ${cid} and teacher_id = ${tid}`;
    else await tx`insert into course_teachers values (${cid}, ${tid}) on conflict do nothing`;
    await audit(tx, u.id, remove ? "teacher.remove" : "teacher.assign", "course", cid, { teacherId: tid });
  }, [path]);
  await back(path, ok);
}

export async function grantAccessAction(fd: FormData) {
  const sid = id(fd, "studentId");
  const cid = id(fd, "courseId");
  const path = `/admin/students/${sid}`;
  const ok = !!sid && !!cid && await run(async (tx, u) => {
    const r = await tx`
      insert into enrollments (user_id, course_id, source) values (${sid}, ${cid}, 'manual')
      on conflict (user_id, course_id) do update
        set status = 'active', revoked_at = null, source = 'manual', granted_at = now()
      returning id`;
    if (r.length === 0) throw new Error("denied");
    await audit(tx, u.id, "enrollment.grant", "student", sid, { courseId: cid });
  }, [path]);
  await back(path, ok);
}

export async function revokeAccessAction(fd: FormData) {
  const sid = id(fd, "studentId");
  const cid = id(fd, "courseId");
  const path = `/admin/students/${sid}`;
  const ok = !!sid && !!cid && await run(async (tx, u) => {
    const r = await tx`
      update enrollments set status = 'revoked', revoked_at = now()
      where user_id = ${sid} and course_id = ${cid} returning id`;
    if (r.length === 0) throw new Error("denied");
    await audit(tx, u.id, "enrollment.revoke", "student", sid, { courseId: cid });
  }, [path]);
  await back(path, ok);
}

// ---------- Экзамены и сертификаты ----------
import { issueCertificate, reviewSubmission } from "@/lib/exams";

export async function reviewAction(fd: FormData) {
  const u = await staff();
  const sid = id(fd, "id");
  const ok = !!u && !!sid && await reviewSubmission(u.id, sid, Number(fd.get("score")), String(fd.get("feedback") ?? ""));
  revalidatePath("/admin/reviews", "page");
  await back("/admin/reviews", ok);
}

export async function issueCertificateAction(fd: FormData) {
  const u = await staff();
  const uid = id(fd, "userId");
  const cid = id(fd, "courseId");
  const ok = !!u && !!uid && !!cid && await issueCertificate(u.id, uid, cid);
  revalidatePath("/admin/certificates", "page");
  await back("/admin/certificates", ok);
}

function readLines(fd: FormData, name: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const l of LANGS) {
    const lines = String(fd.get(`${name}_${l}`) ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8);
    if (lines.length) out[l] = lines;
  }
  return out;
}

export async function addQuestionAction(fd: FormData) {
  const lid = id(fd, "lessonId");
  const prompt = readLoc(fd, "prompt");
  const lines = readLines(fd, "options");
  const correct = Number(fd.get("correct"));
  const n = lines.ru?.length ?? 0;
  const path = `/admin/lessons/${lid}/quiz`;
  const valid = !!lid && !!prompt.ru && n >= 2 && Number.isInteger(correct) && correct >= 1 && correct <= n
    && Object.values(lines).every((a) => a.length === n);
  const ok = valid && await run(async (tx, u) => {
    const options = Array.from({ length: n }, (_, i) => ({
      id: String.fromCharCode(97 + i),
      text: Object.fromEntries(Object.entries(lines).map(([l, a]) => [l, a[i]])),
    }));
    const [q] = await tx<{ id: string }[]>`
      insert into quiz_questions (lesson_id, position, prompt, options, correct_option)
      values (${lid}, coalesce((select max(position) from quiz_questions where lesson_id = ${lid}), 0) + 1,
              ${tx.json(prompt)}, ${tx.json(options)}, ${String.fromCharCode(96 + correct)})
      returning id`;
    await audit(tx, u.id, "quiz.question.add", "lesson", lid, { questionId: q.id });
  }, [path]);
  await back(path, ok);
}

export async function deleteQuestionAction(fd: FormData) {
  const lid = id(fd, "lessonId");
  const qid = id(fd, "id");
  const path = `/admin/lessons/${lid}/quiz`;
  const ok = !!lid && !!qid && await run(async (tx, u) => {
    const r = await tx`delete from quiz_questions where id = ${qid} and lesson_id = ${lid} returning id`;
    if (r.length === 0) throw new Error("denied");
    await audit(tx, u.id, "quiz.question.delete", "lesson", lid, { questionId: qid });
  }, [path]);
  await back(path, ok);
}

// ---------- Продажи ----------
import { refundPayment, settlePayment } from "@/lib/payments";
import { service } from "@/lib/db";

async function salesStaff() {
  const u = await staff();
  return u && (u.role === "owner" || u.role === "manager") ? u : null;
}

export async function confirmPaymentAction(fd: FormData) {
  const u = await salesStaff();
  const pid = id(fd, "id");
  let ok = false;
  if (u && pid) {
    const [p] = await service()<{ order_ref: string; status: string }[]>`select order_ref, status from payments where id = ${pid}`;
    if (p && (p.status === "pending" || p.status === "failed")) {
      ok = (await settlePayment(p.order_ref, `manual:${u.id}:${p.order_ref}`)).ok;
      if (ok) await service()`insert into audit_log (actor_id, action, entity, entity_id) values (${u.id}, 'payment.confirm_manual', 'payment', ${pid})`;
    }
  }
  revalidatePath("/admin/payments", "page");
  await back("/admin/payments", ok);
}

export async function refundAction(fd: FormData) {
  const u = await salesStaff();
  const pid = id(fd, "id");
  const ok = !!u && !!pid && await refundPayment(u.id, pid);
  revalidatePath("/admin/payments", "page");
  await back("/admin/payments", ok);
}

const LEAD_STATUSES = ["registered", "joined_group", "attended", "purchased", "lost"];

export async function setLeadStatusAction(fd: FormData) {
  const lid = id(fd, "id");
  const status = String(fd.get("status") ?? "");
  const ok = !!lid && LEAD_STATUSES.includes(status) && await run(async (tx, u) => {
    const r = await tx`update leads set status = ${status} where id = ${lid} returning id`;
    if (r.length === 0) throw new Error("denied");
    await tx`insert into lead_events (lead_id, type, data) values (${lid}, 'status_changed', ${tx.json({ status, by: u.id })})`;
    await audit(tx, u.id, "lead.status", "lead", lid, { status });
  }, ["/admin/leads"]);
  await back("/admin/leads", ok);
}
