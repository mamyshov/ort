-- Тесты с автопроверкой. Правильные ответы лежат в отдельной таблице, которую ученик
-- прочитать не может: вопросы без ответов ему отдаёт сервер, проверка тоже на сервере.

alter table lessons add column pass_score integer check (pass_score between 0 and 100);

create table quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references lessons (id) on delete cascade,
  position       integer not null,
  prompt         jsonb not null check (jsonb_typeof(prompt) = 'object'),
  -- [{"id": "a", "text": {"ru": "...", "ky": "...", "en": "..."}}, ...]
  options        jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_option text not null,
  unique (lesson_id, position)
);
create index on quiz_questions (lesson_id);

alter table quiz_questions enable row level security;

create policy quiz_questions_select_staff on quiz_questions for select
  using (current_user_role() = 'owner' or teaches_course(lesson_course_id(lesson_id)));
create policy quiz_questions_write_staff on quiz_questions for all
  using (current_user_role() = 'owner' or teaches_course(lesson_course_id(lesson_id)))
  with check (current_user_role() = 'owner' or teaches_course(lesson_course_id(lesson_id)));

grant select, insert, update, delete on quiz_questions to authenticated;
