import { jsonResponse } from "./http.ts";

export function steamPortalUnavailableResponse(
  request: Request,
): Response | null {
  if (Deno.env.get("STEAM_PORTAL_ENABLED") === "true") {
    return null;
  }

  return jsonResponse(request, {
    error: "The Steam portal is currently unavailable.",
  }, 503);
}
