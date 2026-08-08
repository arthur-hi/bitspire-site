import { requireEnv } from "../_shared/config.ts";
import { secureTextEqual } from "../_shared/crypto.ts";
import { getAdminClient } from "../_shared/database.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "This endpoint accepts only POST requests.");
    }

    const suppliedToken =
      request.headers.get("Authorization")?.replace(/^Bearer /u, "") ?? "";
    const expectedToken = requireEnv("KEEPALIVE_TOKEN");

    if (
      !suppliedToken || !await secureTextEqual(suppliedToken, expectedToken)
    ) {
      throw new HttpError(401, "The health request is not authorized.");
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("games")
      .select("game_key")
      .eq("game_key", "tithe")
      .single();

    if (error || !data) {
      throw new Error(
        `The database health check failed: ${error?.message ?? "No game."}`,
      );
    }

    const { error: cleanupError } = await admin.rpc(
      "cleanup_expired_auth_data",
    );

    if (cleanupError) {
      throw new Error(`The session cleanup failed: ${cleanupError.message}`);
    }

    return jsonResponse(request, {
      ok: true,
      database: "available",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});
