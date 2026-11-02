import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Все пути, кроме служебных (api, _next, файлы со значком точки)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
