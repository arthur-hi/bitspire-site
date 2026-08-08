import { getSiteUrl, requireEnv } from "../_shared/config.ts";
import { makeRandomToken, sha256Hex } from "../_shared/crypto.ts";
import { getAdminClient } from "../_shared/database.ts";
import { HttpError, redirectResponse } from "../_shared/http.ts";
import { getSteamProfile, verifySteamLogin } from "../_shared/steam.ts";

Deno.serve(async (request) => {
  const siteCallbackUrl = new URL("/auth/callback/", getSiteUrl());

  try {
    if (request.method !== "GET") {
      throw new HttpError(405, "This endpoint accepts only GET requests.");
    }

    const requestUrl = new URL(request.url);
    const state = requestUrl.searchParams.get("state") ?? "";

    if (!/^[A-Za-z0-9_-]{43}$/u.test(state)) {
      throw new HttpError(400, "The login state is not valid.");
    }

    const stateHash = await sha256Hex(state);
    const expectedReturnTo = new URL(
      "/functions/v1/steam-auth-callback",
      requireEnv("SUPABASE_URL"),
    );
    expectedReturnTo.searchParams.set("state", state);
    const mode = requestUrl.searchParams.get("openid.mode");

    if (mode === "cancel") {
      await consumeAuthAttempt(stateHash);
      siteCallbackUrl.searchParams.set("error", "cancelled");
      return redirectResponse(siteCallbackUrl);
    }

    const steamId = await verifySteamLogin(requestUrl, expectedReturnTo);
    await consumeAuthAttempt(stateHash);
    const profile = await getSteamProfile(steamId);
    const admin = getAdminClient();
    const { data: user, error: userError } = await admin
      .from("steam_users")
      .upsert(
        {
          steam_id: profile.steamId,
          persona_name: profile.personaName,
          profile_url: profile.profileUrl,
          avatar_url: profile.avatarUrl,
          avatar_medium_url: profile.avatarMediumUrl,
          avatar_full_url: profile.avatarFullUrl,
          community_visibility_state: profile.communityVisibilityState,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: "steam_id" },
      )
      .select("id")
      .single();

    if (userError || !user) {
      throw new Error(
        `The server could not save the user: ${userError?.message ?? "No user."
        }`,
      );
    }

    const code = makeRandomToken();
    const codeHash = await sha256Hex(code);
    const codeExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const { error: codeError } = await admin
      .from("login_codes")
      .insert({
        code_hash: codeHash,
        user_id: user.id,
        expires_at: codeExpiresAt,
      });

    if (codeError) {
      throw new Error(
        `The server could not create the login code: ${codeError.message}`,
      );
    }

    siteCallbackUrl.searchParams.set("code", code);
    return redirectResponse(siteCallbackUrl);
  } catch (error) {
    console.error(error);
    siteCallbackUrl.search = "";
    siteCallbackUrl.searchParams.set("error", "auth_failed");
    return redirectResponse(siteCallbackUrl);
  }
});

async function consumeAuthAttempt(stateHash: string): Promise<void> {
  const { data, error } = await getAdminClient().rpc("consume_auth_attempt", {
    input_hash: stateHash,
  });

  if (error) {
    throw new Error(
      `The server could not check the login state: ${error.message}`,
    );
  }

  if (data !== true) {
    throw new HttpError(400, "The login state has expired or was used before.");
  }
}