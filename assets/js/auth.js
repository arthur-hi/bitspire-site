import { callFunction } from "./api.js";
import { getFunctionUrl } from "./config.js";
import {
  clearSessionToken,
  getSessionToken,
  saveLoginReturnPath,
} from "./session-store.js";

let contextPromise = null;

export function getAnonymousContext() {
  return {
    authenticated: false,
    user: null,
    games: {
      tithe: {
        allowed: false,
        isOnSteam: false,
        downloadsEnabled: false,
      },
    },
  };
}

export async function getAuthContext({ refresh = false } = {}) {
  if (!getSessionToken()) {
    return getAnonymousContext();
  }

  if (!contextPromise || refresh) {
    contextPromise = callFunction("auth-context", { needsSession: true })
      .catch((error) => {
        contextPromise = null;

        if (error.status === 401) {
          return getAnonymousContext();
        }

        throw error;
      });
  }

  return contextPromise;
}

export async function initializeAuthUi() {
  try {
    setLoginLinks();
    setLoadingState();

    for (const button of document.querySelectorAll("[data-logout]")) {
      button.addEventListener("click", logout);
    }

    const context = await getAuthContext();
    renderAuthContext(context);
    dispatchContext(context);
  } catch (error) {
    renderAuthError(error.message);
  }
}

async function logout() {
  try {
    await callFunction("logout", {
      method: "POST",
      needsSession: true,
    });
  } catch {
    // Local logout must work when the remote service is not available.
  }

  clearSessionToken();
  contextPromise = null;
  const context = getAnonymousContext();
  renderAuthContext(context);
  dispatchContext(context);
}

function setLoginLinks() {
  const loginUrl = getFunctionUrl("steam-auth-start");

  for (const link of document.querySelectorAll("[data-steam-login]")) {
    link.href = loginUrl;
    link.addEventListener("click", () => {
      saveLoginReturnPath(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
    });
  }
}

function setLoadingState() {
  setElementsHidden("[data-auth-anonymous]", true);
  setElementsHidden("[data-auth-user]", true);
  setElementsHidden("[data-auth-loading]", false);
}

function renderAuthContext(context) {
  setElementsHidden("[data-auth-loading]", true);
  setElementsHidden("[data-auth-anonymous]", context.authenticated);
  setElementsHidden("[data-auth-user]", !context.authenticated);

  if (!context.authenticated) {
    return;
  }

  for (const element of document.querySelectorAll("[data-steam-name]")) {
    element.textContent = context.user.personaName;
  }

  for (const element of document.querySelectorAll("[data-steam-id]")) {
    element.textContent = context.user.steamId;
  }

  for (const image of document.querySelectorAll("[data-steam-avatar]")) {
    const avatarUrl = getSafeUrl(
      context.user.avatarFullUrl || context.user.avatarMediumUrl ||
        context.user.avatarUrl,
      ["steamstatic.com", "akamaihd.net"],
    );

    if (avatarUrl) {
      image.src = avatarUrl;
      image.alt = `${context.user.personaName} Steam avatar`;
    } else {
      image.src = "/assets/avatar-placeholder.svg";
      image.alt = "No Steam avatar is available";
    }
  }

  for (const link of document.querySelectorAll("[data-steam-profile]")) {
    const profileUrl = getSafeUrl(context.user.profileUrl, [
      "steamcommunity.com",
    ]);

    if (profileUrl) {
      link.href = profileUrl;
    } else {
      link.href = "https://steamcommunity.com/";
    }
  }

  const accessText = context.games.tithe.allowed
    ? "Playtester"
    : "";

  for (const element of document.querySelectorAll("[data-tithe-access]")) {
    element.textContent = accessText;
  }
}

function renderAuthError(message) {
  setElementsHidden("[data-auth-loading]", true);
  setElementsHidden("[data-auth-anonymous]", false);

  for (const element of document.querySelectorAll("[data-auth-error]")) {
    element.textContent = message;
    element.hidden = false;
  }
}

function setElementsHidden(selector, hidden) {
  for (const element of document.querySelectorAll(selector)) {
    element.hidden = hidden;
  }
}

function dispatchContext(context) {
  document.dispatchEvent(
    new CustomEvent("bitspire:auth-context", { detail: context }),
  );
}

function getSafeUrl(value, allowedHostSuffixes) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    const hostIsAllowed = allowedHostSuffixes.some(
      (suffix) =>
        url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
    return url.protocol === "https:" && hostIsAllowed ? url.toString() : null;
  } catch {
    return null;
  }
}
