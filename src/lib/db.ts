import "server-only";
import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;
export type Tx = postgres.TransactionSql;

declare global {
  // Одно подключение на процесс (в разработке переживает перезагрузку модулей). prepare: false нужен для пула соединений Supabase (режим transaction)
  var __sql: Sql | undefined;
}

/** Серверное подключение от владельца таблиц: обходит правила доступа (RLS). Только для серверных задач. */
export function service(): Sql {
  if (!globalThis.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Не задана переменная DATABASE_URL");
    globalThis.__sql = postgres(url, { max: Number(process.env.DB_POOL_MAX) || 5, prepare: false, onnotice: () => {} });
  }
  return globalThis.__sql;
}

/**
 * Выполняет запросы от имени пользователя (или гостя при null) с включёнными правилами доступа.
 * База сама не даст прочитать или изменить то, что роли не положено, даже если в коде ошибка.
 */
export async function withUser<T>(
  userId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const result = await service().begin(async (tx) => {
    await tx`select set_config('app.user_id', ${userId ?? ""}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  });
  return result as T;
}
