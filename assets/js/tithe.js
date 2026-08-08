import { callFunction } from "./api.js";
import { getAuthContext } from "./auth.js";
import { detectDesktopSystem } from "./os.js";

startTithePage();

async function startTithePage() {
  try {
    const context = await getAuthContext();

    if (!context.authenticated) {
      showSection("anonymous");
      return;
    }

    if (!context.games.tithe.allowed) {
      showSection("denied");
      return;
    }

    showSection("allowed");
    await loadDistribution();
  } catch (error) {
    showError(error.message);
  }
}

async function loadDistribution() {
  const data = await callFunction("tithe-downloads", { needsSession: true });

  if (data.mode === "steam") {
    renderSteamLink(data.steamUrl);
    return;
  }

  if (data.mode === "disabled") {
    document.querySelector("[data-download-status]").textContent =
      "Downloads are not available at this time.";
    return;
  }

  renderDownloads(Array.isArray(data.downloads) ? data.downloads : []);
}

function renderSteamLink(value) {
  const url = getSecureUrl(value);

  if (!url) {
    showError("The Steam page address is not valid.");
    return;
  }

  const container = document.querySelector("[data-download-list]");
  const link = document.createElement("a");
  link.className = "download-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open Tithe on Steam";
  container.replaceChildren(link);
  document.querySelector("[data-download-status]").textContent =
    "Tithe is now distributed through Steam.";
}

function renderDownloads(downloads) {
  const container = document.querySelector("[data-download-list]");
  const detectedPlatform = detectDesktopSystem().platform;
  const items = [];

  for (const download of downloads) {
    const item = document.createElement("div");
    item.className = "download-item";

    if (typeof download.platform === "string") {
      item.dataset.platform = download.platform;
    }

    if (download.platform === detectedPlatform) {
      item.classList.add("download-item--suggested");
    }

    const title = document.createElement("h3");
    title.textContent = typeof download.label === "string"
      ? download.label
      : "Build";
    item.append(title);

    if (download.platform === detectedPlatform) {
      const suggestion = document.createElement("p");
      suggestion.className = "download-note";
      suggestion.textContent = "Suggested for this system";
      item.append(suggestion);
    }

    if (download.available) {
      const url = getSecureUrl(download.url);

      if (!url) {
        showError("A download address is not valid.");
        return;
      }

      const link = document.createElement("a");
      link.className = "download-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = download.version
        ? `Download ${download.version}`
        : "Download";
      item.append(link);
    } else {
      const unavailable = document.createElement("p");
      unavailable.textContent = download.platform === "macos"
        ? "macOS build: planned"
        : "This build is not available.";
      item.append(unavailable);
    }

    items.push(item);
  }

  container.replaceChildren(...items);
  document.querySelector("[data-download-status]").textContent =
    "Select a build. Each link opens Google Drive in a new tab.";
}

function showSection(name) {
  for (const section of document.querySelectorAll("[data-tithe-section]")) {
    section.hidden = section.dataset.titheSection !== name;
  }
}

function showError(message) {
  showSection("error");
  document.querySelector("[data-tithe-error]").textContent = message;
}

function getSecureUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
