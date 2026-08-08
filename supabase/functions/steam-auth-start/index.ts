import { getSiteUrl, requireEnv } from "../_shared/config.ts";
import { makeRandomToken, sha256Hex } from "../_shared/crypto.ts";
import { getAdminClient } from "../_shared/database.ts";
import { errorResponse, HttpError, redirectResponse } from "../_shared/http.ts";
import { makeSteamLoginUrl } from "../_shared/steam.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "GET") {
      throw new HttpError(405, "This endpoint accepts only GET requests.");
    }

    const state = makeRandomToken();
    const stateHash = await sha256Hex(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await getAdminClient()
      .from("auth_attempts")
      .insert({ state_hash: stateHash, expires_at: expiresAt });

    if (error) {
      throw new Error(`The server could not start the login: ${error.message}`);
    }

    const supabaseUrl = new URL(requireEnv("SUPABASE_URL"));
    const callbackUrl = new URL(
      "/functions/v1/steam-auth-callback",
      supabaseUrl,
    );
    callbackUrl.searchParams.set("state", state);

    const realm = new URL("/", supabaseUrl);
    const loginUrl = makeSteamLoginUrl(callbackUrl, realm);
    return redirectResponse(loginUrl);
  } catch (error) {
    console.error(error);
    const failureUrl = new URL("/auth/callback/", getSiteUrl());
    failureUrl.searchParams.set("error", "start_failed");

    if (error instanceof HttpError && error.status === 405) {
      return errorResponse(request, error);
    }

    return redirectResponse(failureUrl);
  }
});
