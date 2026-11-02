import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled } from "@/lib/auth";
import { UI_LOCALES } from "@/i18n/locales";


const redirectBase = (req: NextRequest) => (process.env.SITE_URL ?? req.nextUrl.origin).replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("locale") ?? "ru";
  const locale = (UI_LOCALES as readonly string[]).includes(l) ? l : "ru";
  if (!googleEnabled()) return NextResponse.redirect(`${redirectBase(req)}/${locale}/login`);
  const state = randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${redirectBase(req)}/api/auth/google/callback`,
    response_type: "code", scope: "openid email profile", state, prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", `${state}.${locale}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600,
  });
  return res;
}
