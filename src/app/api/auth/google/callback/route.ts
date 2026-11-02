import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled, signInWithGoogle } from "@/lib/auth";
import { UI_LOCALES } from "@/i18n/locales";
import { tooMany } from "@/lib/ratelimit";

const base = (req: NextRequest) => (process.env.SITE_URL ?? req.nextUrl.origin).replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("g_state")?.value ?? "";
  const [state, l] = cookie.split(".");
  const locale = (UI_LOCALES as readonly string[]).includes(l) ? l : "ru";
  const fail = (why: string) => {
    const res = NextResponse.redirect(`${base(req)}/${locale}/login?error=${why}`);
    res.cookies.delete({ name: "g_state", path: "/api/auth/google" });
    return res;
  };
  if (!googleEnabled() || (await tooMany("google", 20))) return fail("google");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !state || state !== req.nextUrl.searchParams.get("state")) return fail("google");
  try {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${base(req)}/api/auth/google/callback`, grant_type: "authorization_code",
      }),
    });
    if (!tok.ok) return fail("google");
    const { access_token } = (await tok.json()) as { access_token?: string };
    if (!access_token) return fail("google");
    const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` } });
    if (!ui.ok) return fail("google");
    const p = (await ui.json()) as { email?: string; email_verified?: boolean; name?: string };
    if (!p.email || p.email_verified !== true) return fail("google");
    const r = await signInWithGoogle({ email: p.email, name: p.name ?? null, locale });
    if (!r.ok) return fail(r.reason === "staff" ? "staff" : "google");
    const res = NextResponse.redirect(`${base(req)}/${locale}/app`);
    res.cookies.delete({ name: "g_state", path: "/api/auth/google" });
    return res;
  } catch {
    return fail("google");
  }
}
