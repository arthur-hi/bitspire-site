create extension if not exists pgcrypto with schema extensions;

create table public.steam_users (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null unique check (steam_id ~ '^[0-9]{15,20}$'),
  persona_name text not null,
  profile_url text not null,
  avatar_url text,
  avatar_medium_url text,
  avatar_full_url text,
  community_visibility_state integer,
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.steam_users is
  'This table has one row for each Steam user who completes a valid login.';

create table public.games (
  game_key text primary key check (game_key ~ '^[a-z0-9-]+$'),
  title text not null,
  is_on_steam boolean not null default false,
  steam_url text,
  downloads_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_steam_url_required check (
    not is_on_steam or steam_url is not null
  )
);

comment on column public.games.is_on_steam is
  'Set this value to true when the site must send approved users to Steam.';

create table public.game_whitelist (
  game_key text not null references public.games(game_key) on delete cascade,
  steam_id text not null check (steam_id ~ '^[0-9]{15,20}$'),
  is_allowed boolean not null default true,
  note text,
  added_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_key, steam_id)
);

comment on table public.game_whitelist is
  'This table controls access to each game. A Steam ID is a 64-bit decimal ID. It is not a UUID.';

create table public.game_build_links (
  game_key text not null references public.games(game_key) on delete cascade,
  platform text not null check (platform in ('windows', 'linux', 'macos')),
  label text not null,
  download_url text,
  version_label text,
  is_available boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (game_key, platform),
  constraint game_build_link_required check (
    not is_available or download_url is not null
  )
);

comment on table public.game_build_links is
  'These links are private application data. Only an Edge Function can return them.';

create table public.auth_attempts (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.login_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.steam_users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.steam_users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index app_sessions_user_id_index
  on public.app_sessions(user_id);

create index app_sessions_expiry_index
  on public.app_sessions(expires_at)
  where revoked_at is null;

create index login_codes_expiry_index
  on public.login_codes(expires_at)
  where used_at is null;

create index auth_attempts_expiry_index
  on public.auth_attempts(expires_at)
  where used_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger steam_users_set_updated_at
before update on public.steam_users
for each row execute function public.set_updated_at();

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create trigger game_whitelist_set_updated_at
before update on public.game_whitelist
for each row execute function public.set_updated_at();

create or replace function public.consume_auth_attempt(input_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  update public.auth_attempts
  set used_at = now()
  where state_hash = input_hash
    and used_at is null
    and expires_at > now();

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

create or replace function public.consume_login_code(input_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_user_id uuid;
begin
  update public.login_codes
  set used_at = now()
  where code_hash = input_hash
    and used_at is null
    and expires_at > now()
  returning user_id into found_user_id;

  return found_user_id;
end;
$$;

create or replace function public.cleanup_expired_auth_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.auth_attempts
  where expires_at < now() - interval '1 day';

  delete from public.login_codes
  where expires_at < now() - interval '1 day';

  delete from public.app_sessions
  where expires_at < now() - interval '30 days'
     or revoked_at < now() - interval '30 days';
end;
$$;

revoke all on function public.consume_auth_attempt(text) from public, anon, authenticated;
revoke all on function public.consume_login_code(text) from public, anon, authenticated;
revoke all on function public.cleanup_expired_auth_data() from public, anon, authenticated;

grant execute on function public.consume_auth_attempt(text) to service_role;
grant execute on function public.consume_login_code(text) to service_role;
grant execute on function public.cleanup_expired_auth_data() to service_role;

alter table public.steam_users enable row level security;
alter table public.games enable row level security;
alter table public.game_whitelist enable row level security;
alter table public.game_build_links enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.login_codes enable row level security;
alter table public.app_sessions enable row level security;

revoke all on table public.steam_users from anon, authenticated;
revoke all on table public.games from anon, authenticated;
revoke all on table public.game_whitelist from anon, authenticated;
revoke all on table public.game_build_links from anon, authenticated;
revoke all on table public.auth_attempts from anon, authenticated;
revoke all on table public.login_codes from anon, authenticated;
revoke all on table public.app_sessions from anon, authenticated;

insert into public.games (
  game_key,
  title,
  is_on_steam,
  steam_url,
  downloads_enabled
)
values ('tithe', 'Tithe', false, null, true)
on conflict (game_key) do nothing;

insert into public.game_build_links (
  game_key,
  platform,
  label,
  download_url,
  version_label,
  is_available
)
values
  ('tithe', 'windows', 'Windows build', null, null, false),
  ('tithe', 'linux', 'Linux build', null, null, false),
  ('tithe', 'macos', 'macOS build', null, null, false)
on conflict (game_key, platform) do nothing;
