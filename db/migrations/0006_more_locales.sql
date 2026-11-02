-- Языки интерфейса: добавлены узбекский, казахский, испанский, португальский и турецкий.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c' and pg_get_constraintdef(c.oid) like '%locale%' and pg_get_constraintdef(c.oid) like '%''ky''%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I check (locale in (''ru'', ''ky'', ''en'', ''uz'', ''kk'', ''es'', ''pt'', ''tr''))', r.tbl, r.conname);
  end loop;
end $$;
