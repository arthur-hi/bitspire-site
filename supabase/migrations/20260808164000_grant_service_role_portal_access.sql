grant usage on schema public to service_role;

grant select, insert, update on table public.steam_users to service_role;
grant select on table public.games to service_role;
grant select on table public.game_whitelist to service_role;
grant select on table public.game_build_links to service_role;
grant insert on table public.auth_attempts to service_role;
grant insert on table public.login_codes to service_role;
grant select, insert, update on table public.app_sessions to service_role;
