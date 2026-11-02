/**
 * Пробный режим: тестовая оплата, пробная отправка сообщений и ответы ИИ без ключа.
 * Включён при разработке, на localhost и на сайте, где явно задано DEMO_MODE=1 (тестовый показ).
 * На настоящем сайте переменную DEMO_MODE задавать нельзя.
 */
export const isDemoSite = () =>
  process.env.DEMO_MODE === "1" ||
  process.env.NODE_ENV !== "production" ||
  /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.SITE_URL ?? "");
