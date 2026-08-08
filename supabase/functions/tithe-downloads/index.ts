import { getAdminClient } from "../_shared/database.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  requireAllowedOrigin,
} from "../_shared/http.ts";
import { getGameAccess, getSessionUser } from "../_shared/session.ts";

interface BuildRow {
  platform: "windows" | "linux" | "macos";
  label: string;
  download_url: string | null;
  version_label: string | null;
  is_available: boolean;
}

Deno.serve(async (request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;

  try {
    requireAllowedOrigin(request);

    if (request.method !== "GET") {
      throw new HttpError(405, "This endpoint accepts only GET requests.");
    }

    const user = await getSessionUser(request);
    const access = await getGameAccess(user.steamId, "tithe");

    if (!access.allowed) {
      throw new HttpError(
        403,
        "This Steam account is not on the Tithe whitelist.",
      );
    }

    const admin = getAdminClient();
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("is_on_steam, steam_url, downloads_enabled")
      .eq("game_key", "tithe")
      .single();

    if (gameError || !game) {
      throw new Error(
        `The server could not read Tithe: ${gameError?.message ?? "No game."}`,
      );
    }

    if (game.is_on_steam) {
      return jsonResponse(request, {
        mode: "steam",
        steamUrl: requireSecureUrl(game.steam_url, "Steam"),
        downloads: [],
      });
    }

    if (!game.downloads_enabled) {
      return jsonResponse(request, {
        mode: "disabled",
        steamUrl: null,
        downloads: [],
      });
    }

    const { data: builds, error: buildsError } = await admin
      .from("game_build_links")
      .select("platform, label, download_url, version_label, is_available")
      .eq("game_key", "tithe");

    if (buildsError) {
      throw new Error(
        `The server could not read the build links: ${buildsError.message}`,
      );
    }

    const platformOrder = new Map([
      ["windows", 0],
      ["linux", 1],
      ["macos", 2],
    ]);
    const downloads = (builds as BuildRow[])
      .sort(
        (left, right) =>
          (platformOrder.get(left.platform) ?? 99) -
          (platformOrder.get(right.platform) ?? 99),
      )
      .map((build) => ({
        platform: build.platform,
        label: build.label,
        version: build.version_label,
        available: build.is_available,
        url: build.is_available
          ? requireSecureUrl(build.download_url, build.label)
          : null,
      }));

    return jsonResponse(request, {
      mode: "direct",
      steamUrl: null,
      downloads,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

function requireSecureUrl(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`The ${label} address is not set.`);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`The ${label} address is not valid.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`The ${label} address must use HTTPS.`);
  }

  return url.toString();
}
