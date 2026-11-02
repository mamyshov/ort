-- Воронка, оформление заказа и очередь сообщений.

-- Скидочная цена: price_usd действует в окне предложения, list_price_usd — обычная цена после него.
alter table packages add column list_price_usd numeric(10, 2) check (list_price_usd >= 0);

-- Заказ создаётся до оплаты и до появления аккаунта: данные покупателя хранятся в самом платеже.
alter table payments
  add column order_ref         text not null default replace(gen_random_uuid()::text, '-', '') unique,
  add column payer_name        text,
  add column payer_email       text,
  add column payer_phone       text,
  add column locale            text not null default 'ru' check (locale in ('ru', 'ky', 'en')),
  add column terms_accepted_at timestamptz,
  add column upsell_of         uuid references payments (id);

-- Сотрудник при возврате не может менять и новые поля
create or replace function payments_guard() returns trigger
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
      and new.order_ref = old.order_ref
      and new.payer_name is not distinct from old.payer_name
      and new.payer_email is not distinct from old.payer_email
      and new.payer_phone is not distinct from old.payer_phone
      and new.terms_accepted_at is not distinct from old.terms_accepted_at
      and new.upsell_of is not distinct from old.upsell_of
      and new.refunded_by = app_uid()
      and new.refunded_at is not null
    ) then
      raise exception 'Сотрудник может только оформить возврат оплаченного платежа';
    end if;
  end if;
  return new;
end;
$$;

-- Очередь сообщений клиентам (WhatsApp, Telegram, почта). Пишет и отправляет только сервер.
create type message_channel as enum ('whatsapp', 'telegram', 'email');
create type message_status  as enum ('queued', 'sent', 'failed', 'cancelled');

create table messages (
  id          uuid primary key default gen_random_uuid(),
  channel     message_channel not null,
  to_address  text not null,
  template    text not null,
  params      jsonb not null default '{}',
  locale      text not null default 'ru' check (locale in ('ru', 'ky', 'en')),
  lead_id     uuid references leads (id) on delete set null,
  user_id     uuid references profiles (id) on delete set null,
  status      message_status not null default 'queued',
  attempts    integer not null default 0,
  send_after  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
create index on messages (status, send_after);
alter table messages enable row level security;
create policy messages_select_staff on messages for select
  using (current_user_role() in ('owner', 'manager'));
grant select on messages to authenticated;
