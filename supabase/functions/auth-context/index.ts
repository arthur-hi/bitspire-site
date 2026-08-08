import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  requireAllowedOrigin,
} from "../_shared/http.ts";
import { getGameAccess, getSessionUser } from "../_shared/session.ts";

Deno.serve(async (request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;

  try {
    requireAllowedOrigin(request);

    if (request.method !== "GET") {
      throw new HttpError(405, "This endpoint accepts only GET requests.");
    }

    const user = await getSessionUser(request);
    const titheAccess = await getGameAccess(user.steamId, "tithe");

    return jsonResponse(request, {
      authenticated: true,
      session: {
        expiresAt: user.sessionExpiresAt,
      },
      user: {
        steamId: user.steamId,
        personaName: user.personaName,
        profileUrl: user.profileUrl,
        avatarUrl: user.avatarUrl,
        avatarMediumUrl: user.avatarMediumUrl,
        avatarFullUrl: user.avatarFullUrl,
      },
      games: {
        tithe: {
          allowed: titheAccess.allowed,
          isOnSteam: titheAccess.isOnSteam,
          downloadsEnabled: titheAccess.downloadsEnabled,
        },
      },
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});
