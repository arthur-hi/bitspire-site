import { callFunction } from "./api.js";
import { setSessionToken, takeLoginReturnPath } from "./session-store.js";

const statusElement = document.querySelector("[data-callback-status]");
const requestUrl = new URL(window.location.href);
const code = requestUrl.searchParams.get("code");
const errorCode = requestUrl.searchParams.get("error");

window.history.replaceState({}, document.title, window.location.pathname);

if (errorCode) {
  showFailure(getErrorMessage(errorCode));
} else if (!code) {
  showFailure("The callback has no login code.");
} else {
  exchangeCode(code);
}

async function exchangeCode(loginCode) {
  try {
    const result = await callFunction("session-exchange", {
      method: "POST",
      body: { code: loginCode },
    });

    if (typeof result.sessionToken !== "string") {
      throw new Error("The server returned no session token.");
    }

    setSessionToken(result.sessionToken);
    statusElement.textContent =
      "Steam login is complete. The site will now continue.";
    window.location.replace(takeLoginReturnPath());
  } catch (error) {
    showFailure(error.message);
  }
}

function showFailure(message) {
  statusElement.textContent = message;
  document.querySelector("[data-callback-home]").hidden = false;
}

function getErrorMessage(value) {
  const messages = {
    cancelled: "You cancelled the Steam login.",
    start_failed: "The site could not start the Steam login.",
    auth_failed: "The site could not verify the Steam login.",
  };

  return messages[value] || "The Steam login did not complete.";
}
