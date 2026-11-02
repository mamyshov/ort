-- Основная структура базы: профили и роли, вход, курсы, доступ, прогресс, экзамены,
-- сертификаты, платежи, лиды (CRM), журнал действий, лимиты ИИ.
-- Работает на любом PostgreSQL 14+ (в том числе на Supabase как на обычной базе).
--
-- Вход (пароли, сессии) реализован в приложении. Текущий пользователь передаётся в базу
-- настройкой app.user_id на время запроса, правила доступа (RLS) опираются на неё.
-- Приложение выполняет запросы пользователя от имени роли authenticated; серверные задачи
-- (платежи, лиды из форм, учёт ИИ, вход) выполняются от владельца таблиц и RLS обходят.

------------------------------------------------------------------------------
-- Типы
------------------------------------------------------------------------------
create type user_role         as enum ('student', 'manager', 'teacher', 'owner');
create type lesson_kind       as enum ('video', 'text', 'exam');
create type exam_kind         as enum ('quiz', 'assignment');
create type submission_status as enum ('pending', 'reviewed');
create type enrollment_status as enum ('active', 'revoked', 'expired');
create type payment_method    as enum ('card', 'finik', 'elsom', 'kaspi', 'other');
create type payment_status    as enum ('pending', 'paid', 'refunded', 'failed');
create type lead_status       as enum ('registered', 'joined_group', 'attended', 'purchased', 'lost');

-- Текущий пользователь запроса (пусто для гостя)
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
  locale     text not null default 'ru' check (locale in ('ru', 'ky', 'en')),
  role       user_role not null default 'student',
  created_at timestamptz not null default now()
);
create unique index profiles_email_key on profiles (lower(email));

-- Следующие четыре таблицы доступны только серверу, у роли authenticated прав на них нет
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
-- Курсы, модули, уроки. Тексты хранятся как {"ru": "...", "ky": "...", "en": "..."}
------------------------------------------------------------------------------
create table courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        jsonb not null check (jsonb_typeof(title) = 'object'),
  description  jsonb not null default '{}' check (jsonb_typeof(description) = 'object'),
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Какой преподаватель ведёт какой курс (преподаватель видит и правит только свои курсы)
create table course_teachers (
  course_id  uuid not null references courses (id) on delete cascade,
  teacher_id uuid not null references profiles (id) on delete cascade,
  primary key (course_id, teacher_id)
);

create table modules (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  position  integer not null,
  title     jsonb not null check (jsonb_typeof(title) = 'object'),
  unique (course_id, position)
);

create table lessons (
  id             uuid primary key default gen_random_uuid(),
  module_id      uuid not null references modules (id) on delete cascade,
  position       integer not null,
  title          jsonb not null check (jsonb_typeof(title) = 'object'),
  kind           lesson_kind not null default 'video',
  -- Источник видео сменный: 'bunny', 'youtube', 'vimeo'. video_ref — идентификатор у провайдера.
  video_provider text check (video_provider in ('bunny', 'youtube', 'vimeo')),
  video_ref      text,
  content        jsonb not null default '{}',
  -- Для экзаменов: тест с автопроверкой или задание с проверкой преподавателем
  exam           exam_kind,
  created_at     timestamptz not null default now(),
  unique (module_id, position),
  check ((kind = 'exam') = (exam is not null))
);

------------------------------------------------------------------------------
-- Пакеты (основной, полный, допродажа) и доступ учеников
------------------------------------------------------------------------------
create table packages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      jsonb not null check (jsonb_typeof(title) = 'object'),
  price_usd  numeric(10, 2) not null check (price_usd >= 0),
  is_upsell  boolean not null default false,
  is_active  boolean not null default true
);

create table package_courses (
  package_id uuid not null references packages (id) on delete cascade,
  course_id  uuid not null references courses (id) on delete cascade,
  primary key (package_id, course_id)
);

create table enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  course_id  uuid not null references courses (id) on delete cascade,
  package_id uuid references packages (id),
  status     enrollment_status not null default 'active',
  source     text not null default 'payment' check (source in ('payment', 'manual')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, course_id)
);

create table lesson_progress (
  user_id      uuid not null references profiles (id) on delete cascade,
  lesson_id    uuid not null references lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

------------------------------------------------------------------------------
-- Экзамены и сертификаты
------------------------------------------------------------------------------
create table exam_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  lesson_id     uuid not null references lessons (id) on delete cascade,
  answers       jsonb not null,
  auto_score    numeric(5, 2),            -- для тестов с автопроверкой
  teacher_score numeric(5, 2),            -- итоговая оценка выставляется человеком
  ai_draft      jsonb,                    -- черновик проверки от ИИ, не итоговая оценка
  feedback      text,
  status        submission_status not null default 'pending',
  reviewed_by   uuid references profiles (id),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

create table certificates (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  number    text not null unique,
  issued_by uuid references profiles (id),
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);

------------------------------------------------------------------------------
-- Лиды (CRM) и платежи
------------------------------------------------------------------------------
create table leads (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  phone        text,
  email        text,
  source       text,                      -- например: webinar, instagram, facebook
  status       lead_status not null default 'registered',
  user_id      uuid references profiles (id),
  utm          jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create table lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads (id) on delete cascade,
  type       text not null,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles (id),
  lead_id      uuid references leads (id),
  package_id   uuid references packages (id),
  amount       numeric(10, 2) not null check (amount >= 0),
  currency     text not null default 'USD',
  method       payment_method not null,
  status       payment_status not null default 'pending',
  provider_ref text,                      -- номер операции у провайдера
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  refunded_at  timestamptz,
  refunded_by  uuid references profiles (id),
  -- один и тот же платёж провайдера нельзя записать дважды
  unique (method, provider_ref)
);

------------------------------------------------------------------------------
-- Журнал действий сотрудников и лимиты ИИ
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

create table ai_usage (
  user_id  uuid not null references profiles (id) on delete cascade,
  day      date not null default current_date,
  feature  text not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, day, feature)
);

create index on modules (course_id);
create index on lessons (module_id);
create index on enrollments (user_id);
create index on enrollments (course_id);
create index on lesson_progress (lesson_id);
create index on exam_submissions (lesson_id);
create index on exam_submissions (user_id);
create index on payments (user_id);
create index on lead_events (lead_id);
create index on audit_log (created_at);

------------------------------------------------------------------------------
-- Вспомогательные функции для правил доступа
-- (security definer, чтобы правила не зацикливались на самих себе)
------------------------------------------------------------------------------
create function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = app_uid()
$$;

create function teaches_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from course_teachers
    where course_id = p_course and teacher_id = app_uid()
  )
$$;

create function has_course_access(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e
    where e.user_id = app_uid()
      and e.course_id = p_course
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  )
$$;

create function module_course_id(p_module uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select course_id from modules where id = p_module
$$;

create function lesson_course_id(p_lesson uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.course_id from lessons l join modules m on m.id = l.module_id where l.id = p_lesson
$$;

-- Курс видят: ученик с доступом, владелец, менеджер, преподаватель этого курса
create function can_view_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_course_access(p_course)
      or current_user_role() in ('owner', 'manager')
      or teaches_course(p_course)
$$;

-- Курс правят: владелец и преподаватель этого курса (менеджер не правит контент)
create function can_edit_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select current_user_role() = 'owner' or teaches_course(p_course)
$$;

------------------------------------------------------------------------------
-- Правила доступа (RLS)
------------------------------------------------------------------------------
alter table profiles          enable row level security;
alter table courses           enable row level security;
alter table course_teachers   enable row level security;
alter table modules           enable row level security;
alter table lessons           enable row level security;
alter table packages          enable row level security;
alter table package_courses   enable row level security;
alter table enrollments       enable row level security;
alter table lesson_progress   enable row level security;
alter table exam_submissions  enable row level security;
alter table certificates      enable row level security;
alter table leads             enable row level security;
alter table lead_events       enable row level security;
alter table payments          enable row level security;
alter table audit_log         enable row level security;
alter table ai_usage          enable row level security;

-- profiles
create policy profiles_select_own on profiles for select
  using (id = app_uid());
create policy profiles_select_owner_manager on profiles for select
  using (current_user_role() in ('owner', 'manager'));
create policy profiles_select_teacher on profiles for select
  using (
    current_user_role() = 'teacher' and exists (
      select 1 from enrollments e
      join course_teachers ct on ct.course_id = e.course_id
      where e.user_id = profiles.id and ct.teacher_id = app_uid()
    )
  );
-- Свой профиль можно менять, но не роль
create policy profiles_update_own on profiles for update
  using (id = app_uid())
  with check (id = app_uid() and role = current_user_role());
create policy profiles_update_owner on profiles for update
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');

-- courses: опубликованные видны всем (название и описание нужны для продающей страницы)
create policy courses_select_published on courses for select
  using (is_published);
create policy courses_select_staff on courses for select
  using (current_user_role() in ('owner', 'manager') or teaches_course(id));
create policy courses_insert_owner on courses for insert
  with check (current_user_role() = 'owner');
create policy courses_update on courses for update
  using (can_edit_course(id)) with check (can_edit_course(id));
create policy courses_delete_owner on courses for delete
  using (current_user_role() = 'owner');

-- course_teachers
create policy course_teachers_select on course_teachers for select
  using (current_user_role() in ('owner', 'manager') or teacher_id = app_uid());
create policy course_teachers_write_owner on course_teachers for all
  using (current_user_role() = 'owner') with check (current_user_role() = 'owner');

-- modules и lessons: содержимое видно только тем, у кого есть доступ к курсу
create policy modules_select on modules for select
  using (can_view_course(course_id));
create policy modules_write on modules for all
  using (can_edit_course(course_id)) with check (can_edit_course(course_id));

create policy lessons_select on lessons for select
  using (can_view_course(module_course_id(module_id)));
create policy lessons_write on lessons for all
  using (can_edit_course(module_course_id(module_id)))
  with check (can_edit_course(module_course_id(module_id)));

-- packages: цены публичны, менять может только владелец
create policy packages_select on packages for select using (is_active or current_user_role() = 'owner');
create policy packages_write_owner on packages for all
  using (current_user_role() = 'owner') with check (current_user_role() = 'owner');
create policy package_courses_select on package_courses for select using (true);
create policy package_courses_write_owner on package_courses for all
  using (current_user_role() = 'owner') with check (current_user_role() = 'owner');

-- enrollments: выдача и закрытие доступа — владелец и менеджер
create policy enrollments_select_own on enrollments for select
  using (user_id = app_uid());
create policy enrollments_select_staff on enrollments for select
  using (current_user_role() in ('owner', 'manager') or teaches_course(course_id));
create policy enrollments_write_staff on enrollments for all
  using (current_user_role() in ('owner', 'manager'))
  with check (current_user_role() in ('owner', 'manager'));

-- lesson_progress: ученик отмечает только свои уроки и только там, где есть доступ
create policy progress_select_own on lesson_progress for select
  using (user_id = app_uid());
create policy progress_select_staff on lesson_progress for select
  using (
    current_user_role() in ('owner', 'manager')
    or teaches_course(lesson_course_id(lesson_id))
  );
create policy progress_insert_own on lesson_progress for insert
  with check (user_id = app_uid() and has_course_access(lesson_course_id(lesson_id)));
create policy progress_delete_own on lesson_progress for delete
  using (user_id = app_uid());

-- exam_submissions: проверяют владелец и преподаватель курса, менеджер работы не видит
create policy submissions_select_own on exam_submissions for select
  using (user_id = app_uid());
create policy submissions_select_reviewer on exam_submissions for select
  using (
    current_user_role() = 'owner'
    or teaches_course(lesson_course_id(lesson_id))
  );
create policy submissions_insert_own on exam_submissions for insert
  with check (
    user_id = app_uid()
    and status = 'pending'
    -- оценки, черновик ИИ и отзыв ставит только сервер или проверяющий, не сам ученик
    and auto_score is null
    and teacher_score is null
    and ai_draft is null
    and feedback is null
    and reviewed_by is null
    and reviewed_at is null
    and has_course_access(lesson_course_id(lesson_id))
  );
create policy submissions_update_reviewer on exam_submissions for update
  using (
    current_user_role() = 'owner'
    or teaches_course(lesson_course_id(lesson_id))
  )
  with check (
    current_user_role() = 'owner'
    or teaches_course(lesson_course_id(lesson_id))
  );

-- certificates: выдаёт человек (владелец или преподаватель курса)
create policy certificates_select_own on certificates for select
  using (user_id = app_uid());
create policy certificates_select_staff on certificates for select
  using (current_user_role() in ('owner', 'manager') or teaches_course(course_id));
create policy certificates_insert_issuer on certificates for insert
  with check (current_user_role() = 'owner' or teaches_course(course_id));

-- leads и lead_events: владелец и менеджер (записи из форм создаёт сервер)
create policy leads_staff on leads for all
  using (current_user_role() in ('owner', 'manager'))
  with check (current_user_role() in ('owner', 'manager'));
create policy lead_events_staff on lead_events for all
  using (current_user_role() in ('owner', 'manager'))
  with check (current_user_role() in ('owner', 'manager'));

-- payments: ученик видит свои; владелец и менеджер — все и могут оформить возврат.
-- Создаются платежи только сервером (service role).
create policy payments_select_own on payments for select
  using (user_id = app_uid());
create policy payments_select_staff on payments for select
  using (current_user_role() in ('owner', 'manager'));
create policy payments_update_staff on payments for update
  using (current_user_role() in ('owner', 'manager'))
  with check (current_user_role() in ('owner', 'manager'));

-- audit_log: пишут сотрудники от своего имени, читает владелец
create policy audit_insert_staff on audit_log for insert
  with check (
    actor_id = app_uid()
    and current_user_role() in ('owner', 'manager', 'teacher')
  );
create policy audit_select_owner on audit_log for select
  using (current_user_role() = 'owner');

-- ai_usage: ученик видит свой расход, запись только сервером
create policy ai_usage_select_own on ai_usage for select
  using (user_id = app_uid());

------------------------------------------------------------------------------
-- Только сервер: вход и сессии (RLS включён, политик нет, прав у authenticated нет)
------------------------------------------------------------------------------
alter table credentials    enable row level security;
alter table sessions       enable row level security;
alter table password_resets enable row level security;
alter table login_attempts enable row level security;

------------------------------------------------------------------------------
-- Защита платежей: сотрудник (менеджер или владелец) может только оформить возврат
-- оплаченного платежа. Суммы, способ, статус «оплачен» меняет только сервер.
------------------------------------------------------------------------------
create function payments_guard() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if not (
      old.status = 'paid' and new.status = 'refunded'
      and new.id = old.id
      and new.user_id is not distinct from old.user_id
      and new.lead_id is not distinct from old.lead_id
      and new.package_id is not distinct from old.package_id
      and new.amount = old.amount
      and new.currency = old.currency
      and new.method = old.method
      and new.provider_ref is not distinct from old.provider_ref
      and new.created_at = old.created_at
      and new.paid_at is not distinct from old.paid_at
      and new.refunded_by = app_uid()
      and new.refunded_at is not null
    ) then
      raise exception 'Сотрудник может только оформить возврат оплаченного платежа';
    end if;
  end if;
  return new;
end;
$$;

create trigger payments_guard
  before update on payments
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
revoke all on credentials, sessions, password_resets, login_attempts from authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
