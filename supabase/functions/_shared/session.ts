import { getSessionLengthDays } from "./config.ts";
import { makeRandomToken, sha256Hex } from "./crypto.ts";
import { getAdminClient } from "./database.ts";
import { HttpError } from "./http.ts";

export interface SessionUser {
  id: string;
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatarUrl: string | null;
  avatarMediumUrl: string | null;
  avatarFullUrl: string | null;
  sessionExpiresAt: string;
}

export interface GameAccess {
  allowed: boolean;
  isOnSteam: boolean;
  downloadsEnabled: boolean;
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: string;
}> {
  const token = makeRandomToken();
  const sessionHash = await sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + getSessionLengthDays() * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await getAdminClient()
    .from("app_sessions")
    .insert({
      session_hash: sessionHash,
      user_id: userId,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(`The server could not create a session: ${error.message}`);
  }

  return { token, expiresAt };
}

export async function getSessionUser(request: Request): Promise<SessionUser> {
  const token = getBearerToken(request);
  const sessionHash = await sha256Hex(token);
  const admin = getAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("app_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("session_hash", sessionHash)
    .maybeSingle();

  if (sessionError) {
    throw new Error(
      `The server could not read the session: ${sessionError.message}`,
    );
  }

  if (
    !session ||
    session.revoked_at ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    throw new HttpError(401, "The login session is not valid.");
  }

  const { data: user, error: userError } = await admin
    .from("steam_users")
    .select(
      "id, steam_id, persona_name, profile_url, avatar_url, avatar_medium_url, avatar_full_url",
    )
    .eq("id", session.user_id)
    .single();

  if (userError || !user) {
    throw new Error(
      `The server could not read the user: ${userError?.message ?? "No user."}`,
    );
  }

  const { error: touchError } = await admin
    .from("app_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("session_hash", sessionHash);

  if (touchError) {
    console.error(
      `The server could not update the session time: ${touchError.message}`,
    );
  }

  return {
    id: user.id,
    steamId: user.steam_id,
    personaName: user.persona_name,
    profileUrl: user.profile_url,
    avatarUrl: user.avatar_url,
    avatarMediumUrl: user.avatar_medium_url,
    avatarFullUrl: user.avatar_full_url,
    sessionExpiresAt: session.expires_at,
  };
}

export async function getGameAccess(
  steamId: string,
  gameKey: string,
): Promise<GameAccess> {
  const admin = getAdminClient();
  const [
    { data: game, error: gameError },
    { data: access, error: accessError },
  ] = await Promise.all([
    admin
      .from("games")
      .select("is_on_steam, downloads_enabled")
      .eq("game_key", gameKey)
      .single(),
    admin
      .from("game_whitelist")
      .select("is_allowed")
      .eq("game_key", gameKey)
      .eq("steam_id", steamId)
      .maybeSingle(),
  ]);

  if (gameError || !game) {
    throw new Error(
      `The server could not read the game: ${gameError?.message ?? "No game."}`,
    );
  }

  if (accessError) {
    throw new Error(
      `The server could not read game access: ${accessError.message}`,
    );
  }

  return {
    allowed: access?.is_allowed === true,
    isOnSteam: game.is_on_steam,
    downloadsEnabled: game.downloads_enabled,
  };
}

export async function revokeSession(request: Request): Promise<void> {
  const token = getBearerToken(request);
  const sessionHash = await sha256Hex(token);
  const { error } = await getAdminClient()
    .from("app_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_hash", sessionHash)
    .is("revoked_at", null);

  if (error) {
    throw new Error(`The server could not close the session: ${error.message}`);
  }
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{43})$/u);

  if (!match) {
    throw new HttpError(401, "The request has no valid login session.");
  }

  return match[1];
}
