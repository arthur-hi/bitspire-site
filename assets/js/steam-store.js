const TITHE_STEAM_STORE = {
  url: "https://store.steampowered.com/app/5214830/Tithe/",
  isLive: false,
};

export function initSteamStoreLinks() {
  if (!TITHE_STEAM_STORE.isLive) return;

  for (const link of document.querySelectorAll("[data-tithe-steam-link]")) {
    link.href = TITHE_STEAM_STORE.url;
    link.hidden = false;
  }
}
