const SESSION_KEY = "bitspire.steam-session.v1";
const RETURN_PATH_KEY = "bitspire.login-return-path.v1";
let memoryToken = null;

export function getSessionToken() {
  try {
    return window.localStorage.getItem(SESSION_KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setSessionToken(token) {
  memoryToken = token;

  try {
    window.localStorage.setItem(SESSION_KEY, token);
  } catch {
    // The memory value keeps this browser tab active.
  }
}

export function clearSessionToken() {
  memoryToken = null;

  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // No more work is necessary when local storage is not available.
  }
}

export function saveLoginReturnPath(path) {
  const safePath = isSafeSitePath(path) ? path : "/";

  try {
    window.sessionStorage.setItem(RETURN_PATH_KEY, safePath);
  } catch {
    // The callback page will use the home page when storage is not available.
  }
}

export function takeLoginReturnPath() {
  try {
    const value = window.sessionStorage.getItem(RETURN_PATH_KEY) || "/";
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
    return isSafeSitePath(value) ? value : "/";
  } catch {
    return "/";
  }
}

function isSafeSitePath(value) {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}
