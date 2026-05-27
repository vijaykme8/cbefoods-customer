// routefix1: use POST for Ola Directions API; GET can return 404.
const OLA_STYLE_BASE_URL =
  "https://api.olamaps.io/tiles/vector/v1/styles";

const OLA_STYLE_NAMES = {
  light: "default-light-standard",
  dark: "default-dark-standard"
};

function getStyleUrl(theme = "dark") {
  const styleName = OLA_STYLE_NAMES[String(theme).toLowerCase()] || OLA_STYLE_NAMES.dark;
  return `${OLA_STYLE_BASE_URL}/${styleName}/style.json`;
}

const OLA_REVERSE_URL =
  "https://api.olamaps.io/places/v1/reverse-geocode";

const OLA_DIRECTIONS_URL =
  "https://api.olamaps.io/routing/v1/directions";

const OLA_DIRECTIONS_BASIC_URL =
  "https://api.olamaps.io/routing/v1/directions/basic";

function isAllowedRequestOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "customer-dev.cbefoods-customer.pages.dev" || host === "cbefoods-customer.pages.dev" || host.endsWith(".cbefoods-customer.pages.dev");
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  const allowedOrigin = isAllowedRequestOrigin(origin) ? (origin || "*") : "https://customer-dev.cbefoods-customer.pages.dev";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function isAllowedOlaUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      (
        url.hostname.endsWith("olamaps.io") ||
        url.hostname.endsWith("olakrutrim.com")
      )
    );
  } catch {
    return false;
  }
}

function stripApiKey(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete("api_key");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function withApiKey(rawUrl, apiKey) {
  const url = new URL(rawUrl);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

function normalizeMapLibrePlaceholders(rawUrl) {
  return String(rawUrl || "")
    .replace(/%257B/gi, "{")
    .replace(/%257D/gi, "}")
    .replace(/%7B/gi, "{")
    .replace(/%7D/gi, "}");
}

function proxyUrl(rawUrl, origin) {
  const cleanUrl = normalizeMapLibrePlaceholders(stripApiKey(String(rawUrl)));

  // Keep MapLibre placeholders readable:
  // {z}, {x}, {y}, {fontstack}, {range}
  const encodedUrl = encodeURIComponent(cleanUrl)
    .replace(/%7B/gi, "{")
    .replace(/%7D/gi, "}");

  return `${origin}/ola-maps?type=proxy&url=${encodedUrl}`;
}

function rewriteOlaUrls(value, origin) {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteOlaUrls(item, origin));
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = rewriteOlaUrls(item, origin);
    }
    return output;
  }

  if (typeof value === "string" && isAllowedOlaUrl(value)) {
    return proxyUrl(value, origin);
  }

  return value;
}

async function fetchOla(rawUrl, apiKey, origin, options = {}) {
  if (!isAllowedOlaUrl(rawUrl)) {
    return jsonResponse({ message: "Blocked non-Ola URL" }, 403, origin);
  }

  const upstreamUrl = withApiKey(rawUrl, apiKey);
  const method = options.method || "GET";

  const upstream = await fetch(upstreamUrl, {
    method,
    body: options.body,
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Origin": origin,
      "Referer": origin + "/",
      "User-Agent": "CBEFoods-Cloudflare-Pages-Proxy",
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
  });

  const contentType = upstream.headers.get("content-type") || "";

  if (
    contentType.includes("application/json") ||
    contentType.includes("text/json") ||
    upstreamUrl.endsWith(".json")
  ) {
    const text = await upstream.text();

    try {
      const data = JSON.parse(text);
      const rewritten = rewriteOlaUrls(data, origin);
      return jsonResponse(rewritten, upstream.status, origin);
    } catch {
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...corsHeaders(origin),
          "Content-Type": contentType || "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }
  }

  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    const requestOrigin = request.headers.get("Origin") || new URL(request.url).origin;
    return new Response(null, { headers: corsHeaders(requestOrigin) });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const requestOrigin = request.headers.get("Origin") || origin;
  if (!isAllowedRequestOrigin(requestOrigin)) return jsonResponse({ message: "Origin not allowed" }, 403, requestOrigin);

  const apiKey = env.OLA_MAPS_API_KEY;

  if (!apiKey) {
    return jsonResponse(
      { message: "Missing Cloudflare env var OLA_MAPS_API_KEY" },
      500,
      requestOrigin
    );
  }

  const type = url.searchParams.get("type") || "style";

  try {
    if (type === "config") {
      return jsonResponse({ proxyOnly: true }, 200, requestOrigin);
    }

    if (type === "style") {
      return await fetchOla(getStyleUrl(url.searchParams.get("theme") || "dark"), apiKey, origin);
    }

    if (type === "proxy") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return jsonResponse({ message: "Missing proxy url" }, 400, requestOrigin);
      }
      return await fetchOla(targetUrl, apiKey, origin);
    }

    if (type === "reverse") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");

      if (!lat || !lng) {
        return jsonResponse({ message: "lat and lng are required" }, 400, requestOrigin);
      }

      const reverseUrl =
        `${OLA_REVERSE_URL}?latlng=${encodeURIComponent(`${lat},${lng}`)}` +
        `&language=en`;

      return await fetchOla(reverseUrl, apiKey, origin);
    }

    if (type === "directions") {
      const originLat = url.searchParams.get("originLat");
      const originLng = url.searchParams.get("originLng");
      const destLat = url.searchParams.get("destLat");
      const destLng = url.searchParams.get("destLng");

      if (!originLat || !originLng || !destLat || !destLng) {
        return jsonResponse(
          { message: "originLat, originLng, destLat and destLng are required" },
          400,
          requestOrigin
        );
      }

      const directionsQuery =
        `?origin=${encodeURIComponent(`${originLat},${originLng}`)}` +
        `&destination=${encodeURIComponent(`${destLat},${destLng}`)}` +
        `&alternatives=false` +
        `&steps=false` +
        `&overview=full` +
        `&language=en` +
        `&traffic_metadata=false`;

      // Ola Routing Directions API requires POST even when parameters are in the query string.
      // A GET request can return 404 even with correct coordinates.
      const primary = await fetchOla(
        `${OLA_DIRECTIONS_URL}${directionsQuery}`,
        apiKey,
        origin,
        { method: "POST", body: "" }
      );

      if (primary.status !== 404) {
        return primary;
      }

      // Safety fallback: basic routing endpoint, also POST. Used only when the main endpoint returns 404.
      return await fetchOla(
        `${OLA_DIRECTIONS_BASIC_URL}${directionsQuery}`,
        apiKey,
        origin,
        { method: "POST", body: "" }
      );
    }

    return jsonResponse({ message: "Unknown Ola proxy type" }, 400, requestOrigin);
  } catch (error) {
    return jsonResponse(
      {
        message: "Ola proxy failed",
        error: error.message || String(error),
      },
      500,
      requestOrigin
    );
  }
}
