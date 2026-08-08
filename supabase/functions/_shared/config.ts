export function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`The ${name} environment variable is not set.`);
  }

  return value;
}

export function getSiteUrl(): URL {
  const siteUrl = new URL(requireEnv("SITE_URL"));
  siteUrl.pathname = "/";
  siteUrl.search = "";
  siteUrl.hash = "";
  return siteUrl;
}

export function getAllowedOrigins(): Set<string> {
  const defaultOrigin = getSiteUrl().origin;
  const text = Deno.env.get("ALLOWED_ORIGINS") ?? defaultOrigin;
  const origins = text
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  origins.push(defaultOrigin);
  return new Set(origins);
}

export function getSessionLengthDays(): number {
  const value = Number.parseInt(
    Deno.env.get("SESSION_LENGTH_DAYS") ?? "14",
    10,
  );

  if (!Number.isInteger(value) || value < 1 || value > 90) {
    throw new Error("SESSION_LENGTH_DAYS must be from 1 through 90.");
  }

  return value;
}
