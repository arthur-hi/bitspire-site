import { getAllowedOrigins } from "./config.ts";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function getCorsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  const origin = request.headers.get("Origin");

  if (origin && getAllowedOrigins().has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function requireAllowedOrigin(request: Request): void {
  const origin = request.headers.get("Origin");

  if (!origin || !getAllowedOrigins().has(origin)) {
    throw new HttpError(403, "This site origin is not allowed.");
  }
}

export function optionsResponse(request: Request): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("Origin");

  if (!origin || !getAllowedOrigins().has(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  const headers = getCorsHeaders(request);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(request: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(request, { error: error.message }, error.status);
  }

  console.error(error);
  return jsonResponse(request, {
    error: "The server could not complete the request.",
  }, 500);
}

export function redirectResponse(location: URL): Response {
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Location": location.toString(),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "The request must contain JSON data.");
  }

  let value: unknown;

  try {
    value = await request.json();
  } catch {
    throw new HttpError(400, "The request has invalid JSON data.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "The request must contain a JSON object.");
  }

  return value as Record<string, unknown>;
}
