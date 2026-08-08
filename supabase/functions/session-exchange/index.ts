import { sha256Hex } from "../_shared/crypto.ts";
import { getAdminClient } from "../_shared/database.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonObject,
  requireAllowedOrigin,
} from "../_shared/http.ts";
import { createSession } from "../_shared/session.ts";

Deno.serve(async (request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;

  try {
    requireAllowedOrigin(request);

    if (request.method !== "POST") {
      throw new HttpError(405, "This endpoint accepts only POST requests.");
    }

    const body = await readJsonObject(request);
    const code = typeof body.code === "string" ? body.code : "";

    if (!/^[A-Za-z0-9_-]{43}$/u.test(code)) {
      throw new HttpError(400, "The login code is not valid.");
    }

    const codeHash = await sha256Hex(code);
    const { data: userId, error } = await getAdminClient().rpc(
      "consume_login_code",
      { input_hash: codeHash },
    );

    if (error) {
      throw new Error(
        `The server could not check the login code: ${error.message}`,
      );
    }

    if (!userId) {
      throw new HttpError(
        401,
        "The login code has expired or was used before.",
      );
    }

    const session = await createSession(userId);
    return jsonResponse(request, {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});
