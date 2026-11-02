-- Telegram пишет только тому, кто сам нажал «Старт» у бота: идентификатор чата привязывается к лиду.
alter table leads add column telegram_chat_id text;
