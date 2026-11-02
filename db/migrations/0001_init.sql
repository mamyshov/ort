-- ORT Prep: подготовка к ОРТ (общереспубликанское тестирование, Кыргызстан).
-- Работает на любом PostgreSQL 14+.
--
-- Вход (пароли, сессии) реализован в приложении. Текущий пользователь передаётся в базу
-- настройкой app.user_id на время запроса, правила доступа (RLS) опираются на неё.
-- Запросы пользователя идут от роли authenticated; серверные задачи (проверка ответов,
-- платежи, учёт ИИ, вход) выполняются от владельца таблиц и RLS обходят.

------------------------------------------------------------------------------
-- Типы
------------------------------------------------------------------------------
create type user_role      as enum ('student', 'manager', 'owner');
-- main: основной тест (темы: математика, аналогии, чтение, грамматика);
-- kyrgyz / russian: тест по языку, 50 вопросов (по языку обучения в школе); subject: предметные
create type section_kind   as enum ('main', 'kyrgyz', 'russian', 'subject');
create type attempt_kind   as enum ('practice', 'mock');
create type attempt_status as enum ('in_progress', 'finished');
create type sub_status     as enum ('active', 'revoked');
create type payment_method as enum ('card', 'finik', 'elsom', 'kaspi', 'other');
create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');

create function app_uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

------------------------------------------------------------------------------
-- Профили и вход
------------------------------------------------------------------------------
create table profiles (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  full_name  text,
  phone      text,
  locale     text not null default 'ru' check (locale in ('ru', 'ky')),
  -- Язык обучения в школе: от него зависит, какой тест по языку сдавать (кыргызский или русский)
  school_language text check (school_language in ('ru', 'ky')),
  role       user_role not null default 'student',
  created_at timestamptz not null default now()
);
create unique index profiles_email_key on profiles (lower(email));

-- Доступны только серверу: у роли authenticated прав на них нет
create table credentials (
  user_id       uuid primary key references profiles (id) on delete cascade,
  password_hash text not null,
  updated_at    timestamptz not null default now()
);
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id);
create table password_resets (
  token_hash text primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);
create table login_attempts (
  id      bigint generated always as identity primary key,
  email   text not null,
  success boolean not null,
  at      timestamptz not null default now()
);
create index on login_attempts (lower(email), at);

------------------------------------------------------------------------------
-- Разделы ОРТ, темы и банк вопросов. Тексты: {"ru": "...", "ky": "..."}
------------------------------------------------------------------------------
create table sections (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  kind         section_kind not null,
  title        jsonb not null check (jsonb_typeof(title) = 'object'),
  position     integer not null default 0,
  is_published boolean not null default false
);

create table topics (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections (id) on delete cascade,
  position   integer not null default 0,
  title      jsonb not null check (jsonb_typeof(title) = 'object')
);
create index on topics (section_id);

create table questions (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references sections (id) on delete cascade,
  topic_id     uuid references topics (id) on delete set null,
  -- Текст для чтения (общий для нескольких вопросов) можно положить прямо в вопрос
  passage      jsonb check (passage is null or jsonb_typeof(passage) = 'object'),
  prompt       jsonb not null check (jsonb_typeof(prompt) = 'object'),
  -- [{"id": "a", "text": {"ru": "...", "ky": "..."}}, ...]
  options      jsonb not null check (jsonb_typeof(options) = 'array'),
  difficulty   smallint not null default 2 check (difficulty between 1 and 3),
  is_free      boolean not null default false,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on questions (section_id, topic_id);

-- Правильный ответ и разбор лежат отдельно: ученик эту таблицу прочитать не может.
-- Сервер отдаёт разбор только после ответа.
create table question_keys (
  question_id    uuid primary key references questions (id) on delete cascade,
  correct_option text not null,
  explanation    jsonb not null default '{}' check (jsonb_typeof(explanation) = 'object')
);

create table mock_tests (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        jsonb not null check (jsonb_typeof(title) = 'object'),
  duration_min integer not null check (duration_min > 0),
  position     integer not null default 0,
  is_free      boolean not null default false,
  is_published boolean not null default false
);
-- Из каких разделов и сколько вопросов набирается пробный тест
create table mock_test_parts (
  mock_id        uuid not null references mock_tests (id) on delete cascade,
  section_id     uuid not null references sections (id) on delete cascade,
  question_count integer not null check (question_count > 0),
  primary key (mock_id, section_id)
);

------------------------------------------------------------------------------
-- Попытки. Создаёт и проверяет только сервер: баллы ученик задать не может.
------------------------------------------------------------------------------
create table attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  kind         attempt_kind not null,
  section_id   uuid references sections (id) on delete set null,
  topic_id     uuid references topics (id) on delete set null,
  mock_id      uuid references mock_tests (id) on delete set null,
  question_ids jsonb not null,                    -- порядок вопросов
  answers      jsonb not null default '{}',       -- {question_id: option_id}
  started_at   timestamptz not null default now(),
  deadline     timestamptz,                       -- для пробного теста: конец времени
  finished_at  timestamptz,
  correct      integer,
  total        integer,
  status       attempt_status not null default 'in_progress'
);
create index on attempts (user_id, started_at desc);

------------------------------------------------------------------------------
-- Платный доступ: пакеты и подписки
------------------------------------------------------------------------------
create table packages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       jsonb not null check (jsonb_typeof(title) = 'object'),
  price_usd   numeric(10, 2) not null check (price_usd >= 0),
  access_days integer not null check (access_days > 0),
  is_active   boolean not null default true
);

create table subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  package_id uuid references packages (id),
  status     sub_status not null default 'active',
  source     text not null default 'payment' check (source in ('payment', 'manual')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index on subscriptions (user_id);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles (id),
  package_id   uuid references packages (id),
  amount       numeric(10, 2) not null check (amount >= 0),
  currency     text not null default 'USD',
  method       payment_method not null,
  status       payment_status not null default 'pending',
  provider_ref text,
  order_ref    text not null default replace(gen_random_uuid()::text, '-', '') unique,
  payer_name   text,
  payer_email  text,
  payer_phone  text,
  locale       text not null default 'ru' check (locale in ('ru', 'ky')),
  terms_accepted_at timestamptz,
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  refunded_at  timestamptz,
  refunded_by  uuid references profiles (id),
  -- один и тот же платёж провайдера нельзя записать дважды
  unique (method, provider_ref)
);
create index on payments (user_id);

------------------------------------------------------------------------------
-- Журнал действий сотрудников, лимиты и кэш ИИ
------------------------------------------------------------------------------
create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references profiles (id),
  action     text not null,
  entity     text not null,
  entity_id  text,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on audit_log (created_at);

create table ai_usage (
  user_id  uuid not null references profiles (id) on delete cascade,
  day      date not null default current_date,
  feature  text not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, day, feature)
);

-- Общий кэш ответов ИИ (разбор одного вопроса считается один раз для всех)
create table ai_cache (
  key        text primary key,
  value      jsonb not null,
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Функции для правил доступа (security definer, чтобы правила не зацикливались)
------------------------------------------------------------------------------
create function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = app_uid()
$$;

create function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() = 'owner', false)
$$;

create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() in ('owner', 'manager'), false)
$$;

-- Есть ли у текущего пользователя действующий платный доступ
create function has_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions s
    where s.user_id = app_uid() and s.status = 'active' and s.expires_at > now()
  )
$$;

------------------------------------------------------------------------------
-- Правила доступа (RLS)
------------------------------------------------------------------------------
alter table profiles        enable row level security;
alter table sections        enable row level security;
alter table topics          enable row level security;
alter table questions       enable row level security;
alter table question_keys   enable row level security;
alter table mock_tests      enable row level security;
alter table mock_test_parts enable row level security;
alter table attempts        enable row level security;
alter table packages        enable row level security;
alter table subscriptions   enable row level security;
alter table payments        enable row level security;
alter table audit_log       enable row level security;
alter table ai_usage        enable row level security;
alter table ai_cache        enable row level security;
alter table credentials     enable row level security;
alter table sessions        enable row level security;
alter table password_resets enable row level security;
alter table login_attempts  enable row level security;

-- profiles
create policy profiles_select_own on profiles for select using (id = app_uid());
create policy profiles_select_staff on profiles for select using (is_staff());
-- Свой профиль можно менять, но не роль
create policy profiles_update_own on profiles for update
  using (id = app_uid()) with check (id = app_uid() and role = current_user_role());
create policy profiles_update_owner on profiles for update
  using (is_owner()) with check (is_owner());

-- Разделы, темы, пробные тесты: опубликованное видно всем вошедшим и гостям (названия не секрет)
create policy sections_select on sections for select using (is_published or is_staff());
create policy sections_write_owner on sections for all using (is_owner()) with check (is_owner());
create policy topics_select on topics for select using (true);
create policy topics_write_owner on topics for all using (is_owner()) with check (is_owner());
create policy mock_tests_select on mock_tests for select using (is_published or is_staff());
create policy mock_tests_write_owner on mock_tests for all using (is_owner()) with check (is_owner());
create policy mock_parts_select on mock_test_parts for select using (true);
create policy mock_parts_write_owner on mock_test_parts for all using (is_owner()) with check (is_owner());

-- Вопросы: бесплатные видит любой вошедший, платные — только с действующим доступом.
-- Правила на уровне базы: ошибка в коде не откроет платные вопросы.
create policy questions_select_student on questions for select
  using (app_uid() is not null and is_published and (is_free or has_premium()));
create policy questions_select_owner on questions for select using (is_owner());
create policy questions_write_owner on questions for all using (is_owner()) with check (is_owner());

-- Ключи (правильные ответы и разборы): читает и пишет только владелец; ученику отдаёт сервер
create policy question_keys_owner on question_keys for all using (is_owner()) with check (is_owner());

-- attempts: ученик видит свои, сотрудники — все; писать может только сервер
create policy attempts_select_own on attempts for select using (user_id = app_uid());
create policy attempts_select_staff on attempts for select using (is_staff());

-- packages: цены публичны, менять может только владелец
create policy packages_select on packages for select using (is_active or is_owner());
create policy packages_write_owner on packages for all using (is_owner()) with check (is_owner());

-- subscriptions: выдача и закрытие доступа — владелец и менеджер
create policy subs_select_own on subscriptions for select using (user_id = app_uid());
create policy subs_staff on subscriptions for all using (is_staff()) with check (is_staff());

-- payments: ученик видит свои; владелец и менеджер — все и могут оформить возврат.
-- Создаёт платежи только сервер.
create policy payments_select_own on payments for select using (user_id = app_uid());
create policy payments_select_staff on payments for select using (is_staff());
create policy payments_update_staff on payments for update using (is_staff()) with check (is_staff());

-- audit_log: пишут сотрудники от своего имени, читает владелец
create policy audit_insert_staff on audit_log for insert
  with check (actor_id = app_uid() and is_staff());
create policy audit_select_owner on audit_log for select using (is_owner());

-- ai_usage: ученик видит свой расход, запись только сервером
create policy ai_usage_select_own on ai_usage for select using (user_id = app_uid());

------------------------------------------------------------------------------
-- Защита платежей: сотрудник может только оформить возврат оплаченного платежа.
------------------------------------------------------------------------------
create function payments_guard() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if not (
      old.status = 'paid' and new.status = 'refunded'
      and new.id = old.id
      and new.user_id is not distinct from old.user_id
      and new.package_id is not distinct from old.package_id
      and new.amount = old.amount
      and new.currency = old.currency
      and new.method = old.method
      and new.provider_ref is not distinct from old.provider_ref
      and new.created_at = old.created_at
      and new.paid_at is not distinct from old.paid_at
      and new.order_ref = old.order_ref
      and new.payer_name is not distinct from old.payer_name
      and new.payer_email is not distinct from old.payer_email
      and new.payer_phone is not distinct from old.payer_phone
      and new.terms_accepted_at is not distinct from old.terms_accepted_at
      and new.refunded_by = app_uid()
      and new.refunded_at is not null
    ) then
      raise exception 'Сотрудник может только оформить возврат оплаченного платежа';
    end if;
  end if;
  return new;
end;
$$;
create trigger payments_guard before update on payments
  for each row execute function payments_guard();

------------------------------------------------------------------------------
-- Роль authenticated: от её имени выполняются запросы пользователей
------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant authenticated to current_user;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on credentials, sessions, password_resets, login_attempts, ai_cache from authenticated;
-- Попытки пишет только сервер
revoke insert, update, delete on attempts from authenticated;
revoke insert, update, delete on payments from authenticated;
grant update on payments to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
