import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  requireAllowedOrigin,
} from "../_shared/http.ts";
import { revokeSession } from "../_shared/session.ts";

Deno.serve(async (request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;

  try {
    requireAllowedOrigin(request);

    if (request.method !== "POST") {
      throw new HttpError(405, "This endpoint accepts only POST requests.");
    }

    await revokeSession(request);
    return jsonResponse(request, { loggedOut: true });
  } catch (error) {
    return errorResponse(request, error);
  }
});
