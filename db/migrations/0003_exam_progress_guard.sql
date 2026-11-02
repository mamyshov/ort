-- Урок-экзамен нельзя отметить пройденным вручную: отметку ставит сервер после проверки
-- (тест набрал проходной балл или преподаватель принял задание).
create function lesson_progress_guard() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated'
     and exists (select 1 from lessons where id = new.lesson_id and kind = 'exam') then
    raise exception 'Экзамен нельзя отметить пройденным вручную';
  end if;
  return new;
end;
$$;

create trigger lesson_progress_guard
  before insert on lesson_progress
  for each row execute function lesson_progress_guard();
