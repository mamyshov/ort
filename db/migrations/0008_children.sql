-- Детские профили: ребёнка заводит родитель (guardian_id). У ребёнка нет своей почты и пароля,
-- войти в его кабинет можно только из аккаунта родителя.
alter table profiles add column guardian_id uuid references profiles (id) on delete cascade;
alter table profiles add column age_group text check (age_group in ('kids', 'teens'));
alter table profiles add constraint profiles_child_has_guardian check ((guardian_id is null) = (age_group is null));
create index profiles_guardian_idx on profiles (guardian_id) where guardian_id is not null;

-- Родитель видит профили своих детей
create policy profiles_select_guardian on profiles for select using (guardian_id = app_uid());

-- Для какой аудитории курс
alter table courses add column audience text not null default 'all' check (audience in ('all', 'kids', 'teens', 'adults'));
