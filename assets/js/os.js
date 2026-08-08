export function detectDesktopSystem() {
  return classifyDesktopSystem({
    userAgentDataPlatform: navigator.userAgentData?.platform || "",
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
    maxTouchPoints: navigator.maxTouchPoints || 0,
  });
}

export function classifyDesktopSystem({
  userAgentDataPlatform = "",
  platform = "",
  userAgent = "",
  maxTouchPoints = 0,
}) {
  const source = `${userAgentDataPlatform} ${platform} ${userAgent}`;

  const looksLikeTouchMac = /Macintosh|MacIntel/u.test(source) &&
    maxTouchPoints > 1 &&
    /Mobile/u.test(userAgent);

  if (/iPhone|iPad|iPod/u.test(source) || looksLikeTouchMac) {
    return { system: "iOS or iPadOS", platform: null };
  }

  if (/Android/u.test(source)) {
    return { system: "Android", platform: null };
  }

  if (/CrOS/u.test(source)) {
    return { system: "ChromeOS", platform: null };
  }

  if (/Windows|Win32|Win64/u.test(source)) {
    return { system: "Windows", platform: "windows" };
  }

  if (/Macintosh|MacIntel|MacPPC|Mac68K|macOS/u.test(source)) {
    return { system: "macOS", platform: "macos" };
  }

  if (/Linux|X11/u.test(source)) {
    return { system: "Linux", platform: "linux" };
  }

  return { system: "Unknown", platform: null };
}

export function showSystemEstimate() {
  const result = detectDesktopSystem();
  const buildName = result.platform
    ? `${result.system} build`
    : "No desktop build";

  for (const element of document.querySelectorAll("[data-os-label]")) {
    element.textContent =
      `Estimated system: ${result.system}. Suggested download: ${buildName}.`;
  }

  return result;
}
