-- Начальная структура ОРТ. Вопросы владелец загружает сам (админка → Загрузка).
-- Разделы без вопросов остаются неопубликованными.
insert into sections (slug, kind, title, position, is_published) values
  ('main',      'main',    '{"ru":"Основной тест","ky":"Негизги тест"}', 1, true),
  ('kyrgyz',    'kyrgyz',  '{"ru":"Кыргызский язык","ky":"Кыргыз тили"}', 2, true),
  ('russian',   'russian', '{"ru":"Русский язык","ky":"Орус тили"}', 3, true),
  ('chemistry', 'subject', '{"ru":"Химия","ky":"Химия"}', 10, false),
  ('biology',   'subject', '{"ru":"Биология","ky":"Биология"}', 11, false),
  ('physics',   'subject', '{"ru":"Физика","ky":"Физика"}', 12, false),
  ('math',      'subject', '{"ru":"Математика (предметный)","ky":"Математика (предметтик)"}', 13, false),
  ('history',   'subject', '{"ru":"История","ky":"Тарых"}', 14, false),
  ('english',   'subject', '{"ru":"Английский язык","ky":"Англис тили"}', 15, false),
  ('german',    'subject', '{"ru":"Немецкий язык","ky":"Немис тили"}', 16, false),
  ('kg-lit',    'subject', '{"ru":"Кыргызская литература","ky":"Кыргыз адабияты"}', 17, false),
  ('ru-lit',    'subject', '{"ru":"Русская литература","ky":"Орус адабияты"}', 18, false);

-- Темы основного теста
insert into topics (section_id, position, title)
select s.id, t.position, t.title::jsonb from sections s,
  (values (1, '{"ru":"Математика","ky":"Математика"}'),
          (2, '{"ru":"Аналогии","ky":"Аналогиялар"}'),
          (3, '{"ru":"Чтение и понимание текста","ky":"Текстти окуу жана түшүнүү"}'),
          (4, '{"ru":"Грамматика","ky":"Грамматика"}')) as t(position, title)
where s.slug = 'main';
