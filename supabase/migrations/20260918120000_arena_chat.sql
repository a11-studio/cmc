create table if not exists public.arena_chat_messages (
  id text primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  cycle_id text,
  kind text not null,
  addressed_agent_id text references public.agents (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists arena_chat_messages_created_idx
  on public.arena_chat_messages (created_at);

alter table public.arena_chat_messages enable row level security;

drop policy if exists arena_chat_messages_public_read on public.arena_chat_messages;
create policy arena_chat_messages_public_read on public.arena_chat_messages for select using (true);

do $$
begin
  execute 'alter publication supabase_realtime add table public.arena_chat_messages';
exception
  when duplicate_object then null;
end $$;
