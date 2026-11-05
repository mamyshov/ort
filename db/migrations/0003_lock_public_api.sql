-- На хостингах вроде Supabase таблицы схемы public по умолчанию доступны извне через встроенный
-- REST API ролям anon и authenticated. Сайт ходит в базу напрямую, этот API не нужен: закрываем его.
-- На обычном PostgreSQL ролей anon нет, и миграция ничего не делает.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke execute on all functions in schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
    alter default privileges in schema public revoke all on sequences from anon;
    alter default privileges in schema public revoke execute on functions from anon;
  end if;
end
$$;
