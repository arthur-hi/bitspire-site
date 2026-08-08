import { getFunctionUrl } from "./config.js";

const statusElement = document.querySelector("[data-return-status]");
const spinnerElement = document.querySelector("[data-return-spinner]");
const requestUrl = new URL(window.location.href);
const state = requestUrl.searchParams.get("state") ?? "";

try {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(state)) {
    throw new Error("The Steam return has no valid login state.");
  }

  const callbackUrl = new URL(getFunctionUrl("steam-auth-callback"));
  callbackUrl.search = requestUrl.search;
  window.location.replace(callbackUrl);
} catch (error) {
  spinnerElement.hidden = true;
  statusElement.textContent = error.message;
  statusElement.classList.add("mb-3");
  document.querySelector("[data-return-home]").hidden = false;
}
