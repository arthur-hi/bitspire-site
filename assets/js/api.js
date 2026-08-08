import { getFunctionUrl, SITE_CONFIG } from "./config.js";
import { clearSessionToken, getSessionToken } from "./session-store.js";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function callFunction(
  functionName,
  { method = "GET", body = null, needsSession = false } = {},
) {
  const headers = new Headers({
    "Accept": "application/json",
    "apikey": SITE_CONFIG.supabasePublishableKey,
  });

  if (body !== null) {
    headers.set("Content-Type", "application/json");
  }

  if (needsSession) {
    const token = getSessionToken();

    if (!token) {
      throw new ApiError(401, "No login session is available.");
    }

    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;

  try {
    response = await fetch(getFunctionUrl(functionName), {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "The site could not contact the login service.");
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    // The status code still gives a useful error when no JSON is present.
  }

  if (!response.ok) {
    if (response.status === 401 && needsSession) {
      clearSessionToken();
    }

    const message = typeof data.error === "string"
      ? data.error
      : `The server returned status ${response.status}.`;
    throw new ApiError(response.status, message);
  }

  return data;
}
