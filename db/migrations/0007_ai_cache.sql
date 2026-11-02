-- Общий кэш ответов ИИ: одни и те же карточки к уроку считаются один раз для всех учеников.
-- Только серверное подключение: у роли authenticated прав нет, политик нет.
create table ai_cache (
  key        text primary key,
  value      jsonb not null,
  created_at timestamptz not null default now()
);
alter table ai_cache enable row level security;
