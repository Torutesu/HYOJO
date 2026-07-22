create table if not exists space_policies (
  space_id text primary key,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists huddles (
  id text primary key,
  space_id text not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists huddles_space_id_idx on huddles (space_id);
create table if not exists huddle_memories (
  huddle_id text primary key references huddles(id) on delete cascade,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists huddle_transcripts (
  huddle_id text primary key references huddles(id) on delete cascade,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists audit_events (
  id text primary key,
  space_id text not null,
  document jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_space_created_idx on audit_events (space_id, created_at desc);
