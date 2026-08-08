import { requireEnv } from "./config.ts";
import { HttpError } from "./http.ts";

const STEAM_OPENID_LOGIN_URL = "https://steamcommunity.com/openid/login";
const STEAM_OPENID_NAMESPACE = "http://specs.openid.net/auth/2.0";
const STEAM_IDENTIFIER_SELECT =
  "http://specs.openid.net/auth/2.0/identifier_select";

export interface SteamProfile {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatarUrl: string | null;
  avatarMediumUrl: string | null;
  avatarFullUrl: string | null;
  communityVisibilityState: number | null;
}

interface SteamPlayerResponse {
  response?: {
    players?: Array<{
      steamid?: string;
      personaname?: string;
      profileurl?: string;
      avatar?: string;
      avatarmedium?: string;
      avatarfull?: string;
      communityvisibilitystate?: number;
    }>;
  };
}

export function makeSteamLoginUrl(returnTo: URL, realm: URL): URL {
  const loginUrl = new URL(STEAM_OPENID_LOGIN_URL);
  loginUrl.searchParams.set("openid.ns", STEAM_OPENID_NAMESPACE);
  loginUrl.searchParams.set("openid.mode", "checkid_setup");
  loginUrl.searchParams.set("openid.return_to", returnTo.toString());
  loginUrl.searchParams.set("openid.realm", realm.toString());
  loginUrl.searchParams.set("openid.identity", STEAM_IDENTIFIER_SELECT);
  loginUrl.searchParams.set("openid.claimed_id", STEAM_IDENTIFIER_SELECT);
  return loginUrl;
}

export async function verifySteamLogin(
  requestUrl: URL,
  expectedReturnTo: URL,
): Promise<string> {
  rejectDuplicateOpenIdFields(requestUrl.searchParams);

  if (requestUrl.searchParams.get("openid.mode") !== "id_res") {
    throw new HttpError(400, "Steam did not return a valid login result.");
  }

  if (requestUrl.searchParams.get("openid.ns") !== STEAM_OPENID_NAMESPACE) {
    throw new HttpError(400, "Steam returned an invalid OpenID namespace.");
  }

  if (
    requestUrl.searchParams.get("openid.op_endpoint") !== STEAM_OPENID_LOGIN_URL
  ) {
    throw new HttpError(400, "Steam returned an invalid OpenID endpoint.");
  }

  if (
    requestUrl.searchParams.get("openid.return_to") !==
      expectedReturnTo.toString()
  ) {
    throw new HttpError(400, "Steam returned an invalid callback address.");
  }

  checkSignedFields(requestUrl.searchParams.get("openid.signed"));
  checkResponseNonce(requestUrl.searchParams.get("openid.response_nonce"));

  const verificationBody = new URLSearchParams();

  for (const [name, value] of requestUrl.searchParams) {
    if (name.startsWith("openid.")) {
      verificationBody.append(name, value);
    }
  }

  verificationBody.set("openid.mode", "check_authentication");

  const verificationResponse = await fetch(STEAM_OPENID_LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: verificationBody,
    signal: AbortSignal.timeout(10_000),
  });

  if (!verificationResponse.ok) {
    throw new HttpError(502, "Steam did not verify the login request.");
  }

  const verificationText = await verificationResponse.text();
  const isValid = verificationText
    .split(/\r?\n/u)
    .some((line) => line.trim() === "is_valid:true");

  if (!isValid) {
    throw new HttpError(401, "Steam rejected the login request.");
  }

  const claimedId = requestUrl.searchParams.get("openid.claimed_id");
  const identity = requestUrl.searchParams.get("openid.identity");

  if (!claimedId || identity !== claimedId) {
    throw new HttpError(400, "Steam returned an invalid account identifier.");
  }

  return getSteamIdFromClaimedId(claimedId);
}

function rejectDuplicateOpenIdFields(searchParams: URLSearchParams): void {
  const names = new Set<string>();

  for (const [name] of searchParams) {
    if (!name.startsWith("openid.")) {
      continue;
    }

    if (names.has(name)) {
      throw new HttpError(400, "Steam returned a duplicate OpenID field.");
    }

    names.add(name);
  }
}

function checkSignedFields(value: string | null): void {
  if (!value) {
    throw new HttpError(400, "Steam did not sign the login fields.");
  }

  const fields = new Set(value.split(","));
  const requiredFields = [
    "op_endpoint",
    "return_to",
    "response_nonce",
    "assoc_handle",
    "claimed_id",
    "identity",
  ];

  if (requiredFields.some((field) => !fields.has(field))) {
    throw new HttpError(400, "Steam did not sign all required login fields.");
  }
}

function checkResponseNonce(value: string | null): void {
  if (!value || value.length < 20) {
    throw new HttpError(400, "Steam returned an invalid login nonce.");
  }

  const date = new Date(value.slice(0, 20));
  const age = Date.now() - date.getTime();

  if (
    Number.isNaN(date.getTime()) || age > 10 * 60 * 1000 || age < -2 * 60 * 1000
  ) {
    throw new HttpError(400, "The Steam login result has expired.");
  }
}

function getSteamIdFromClaimedId(claimedId: string): string {
  let claimedUrl: URL;

  try {
    claimedUrl = new URL(claimedId);
  } catch {
    throw new HttpError(400, "Steam returned an invalid account address.");
  }

  if (
    !["http:", "https:"].includes(claimedUrl.protocol) ||
    claimedUrl.hostname !== "steamcommunity.com" ||
    claimedUrl.port ||
    claimedUrl.search ||
    claimedUrl.hash
  ) {
    throw new HttpError(400, "Steam returned an invalid account address.");
  }

  const match = claimedUrl.pathname.match(/^\/openid\/id\/([0-9]{15,20})\/?$/u);

  if (!match) {
    throw new HttpError(400, "Steam returned an invalid Steam ID.");
  }

  return match[1];
}

export async function getSteamProfile(steamId: string): Promise<SteamProfile> {
  const profileUrl = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
  );
  profileUrl.searchParams.set("key", requireEnv("STEAM_WEB_API_KEY"));
  profileUrl.searchParams.set("steamids", steamId);

  const response = await fetch(profileUrl, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new HttpError(502, "Steam did not return the account profile.");
  }

  const data = await response.json() as SteamPlayerResponse;
  const player = data.response?.players?.[0];

  if (
    !player ||
    player.steamid !== steamId ||
    typeof player.personaname !== "string" ||
    typeof player.profileurl !== "string"
  ) {
    throw new HttpError(502, "Steam returned an incomplete account profile.");
  }

  return {
    steamId,
    personaName: player.personaname,
    profileUrl: player.profileurl,
    avatarUrl: player.avatar ?? null,
    avatarMediumUrl: player.avatarmedium ?? null,
    avatarFullUrl: player.avatarfull ?? null,
    communityVisibilityState: player.communityvisibilitystate ?? null,
  };
}
