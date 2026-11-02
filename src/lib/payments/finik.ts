import "server-only";

/**
 * Приём оплаты через Finik. Публичного описания API найти не удалось, поэтому здесь только
 * контракт: после получения документации от Finik нужно реализовать создание платежа
 * и проверку подписи уведомления (/api/webhooks/finik). Пока ключи не заданы, способ не показывается.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createFinikCheckout(_order: { orderRef: string; amountUsd: number; returnUrl: string }): Promise<{ url: string }> {
  throw new Error("Finik: интеграция не реализована, нужна документация API от Finik");
}
