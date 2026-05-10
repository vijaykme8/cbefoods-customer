/* =========================================================
   Ola Maps Cloudflare Pages Function proxy
   Zero-cost MVP path: keeps OLA_MAPS_API_KEY in Cloudflare
   Pages environment variables, not in frontend code.

   Cloudflare Pages route:
   /ola-maps?type=style
   /ola-maps?type=reverse&lat=11.0168&lng=76.9558
   /ola-maps?type=directions&origin=lat,lng&destination=lat,lng
========================================================= */
const OLA_HOSTS = new Set(["api.olamaps.io", "app.olamaps.io"]);
const DEFAULT_STYLE = "default-light-standard";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra
  };
}

function json(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders({
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    })
  });
}

function text(status, body, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: corsHeaders({
      "Content-Type": contentType,
      ...extraHeaders
    })
  });
}

function getOrigin(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function olaRequestHeaders(request, origin, extra = {}) {
  return {
    "Accept": request.headers.get("accept") || "application/json, text/plain, */*",
    "Origin": origin,
    "Referer": `${origin}/`,
    "User-Agent": "cbefoods-cloudflare-ola-proxy/1.0",
    ...extra
  };
}

function assertOlaUrl(raw) {
  const normalized = String(raw || "").replace("https://app.olamaps.io", "https://api.olamaps.io");
  const url = new URL(normalized);
  if (!OLA_HOSTS.has(url.hostname)) throw new Error("Only Ola Maps URLs can be proxied.");
  return url;
}

function withApiKey(url, apiKey) {
  url.searchParams.delete("api_key");
  url.searchParams.set("api_key", apiKey);
  return url;
}

function proxyUrlFor(rawUrl, origin) {
  const clean = String(rawUrl || "").replace("https://app.olamaps.io", "https://api.olamaps.io");
  const encoded = encodeURIComponent(clean).replace(/%7B/g, "{").replace(/%7D/g, "}");
  return `${origin}/ola-maps?type=proxy&url=${encoded}`;
}

function rewriteStyleUrls(value, origin) {
  if (Array.isArray(value)) return value.map(item => rewriteStyleUrls(item, origin));
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) output[key] = rewriteStyleUrls(child, origin);
    return output;
  }
  if (typeof value === "string" && value.includes("olamaps.io")) {
    return proxyUrlFor(value, origin);
  }
  return value;
}

async function fetchJson(url, request, origin, cacheControl = "no-store") {
  const response = await fetch(url, {
    headers: olaRequestHeaders(request, origin)
  });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    data = { error: "Ola Maps returned a non-JSON response", status: response.status };
  }
  return json(response.status, data, { "Cache-Control": cacheControl });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return text(200, "ok");
  if (request.method !== "GET") return json(405, { error: "Method not allowed" });

  const apiKey = env.OLA_MAPS_API_KEY || env.OLA_API_KEY || "";
  if (!apiKey) return json(500, { error: "Missing Cloudflare env var OLA_MAPS_API_KEY" });

  const requestUrl = new URL(request.url);
  const q = requestUrl.searchParams;
  const type = q.get("type") || q.get("action") || "style";
  const origin = getOrigin(request);

  try {
    if (type === "style") {
      const styleName = q.get("style") || DEFAULT_STYLE;
      const styleUrl = withApiKey(new URL(`https://api.olamaps.io/tiles/vector/v1/styles/${styleName}/style.json`), apiKey);
      const response = await fetch(styleUrl, {
        headers: olaRequestHeaders(request, origin)
      });
      let data;
      try {
        data = await response.json();
      } catch (error) {
        data = { error: "Ola Maps returned a non-JSON style response", status: response.status };
      }
      if (!response.ok) return json(response.status, data);
      return json(200, rewriteStyleUrls(data, origin), { "Cache-Control": "public, max-age=3600" });
    }

    if (type === "proxy") {
      const target = assertOlaUrl(q.get("url"));
      withApiKey(target, apiKey);
      const response = await fetch(target, {
        headers: olaRequestHeaders(request, origin, {
          "Accept": request.headers.get("accept") || "*/*"
        })
      });
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: corsHeaders({
          "Content-Type": response.headers.get("content-type") || "application/octet-stream",
          "Cache-Control": response.headers.get("cache-control") || "public, max-age=86400"
        })
      });
    }

    if (type === "reverse") {
      const lat = q.get("lat") || q.get("latitude");
      const lng = q.get("lng") || q.get("lon") || q.get("longitude");
      if (!lat || !lng) return json(400, { error: "lat and lng are required" });
      const url = withApiKey(new URL("https://api.olamaps.io/places/v1/reverse-geocode"), apiKey);
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("language", q.get("language") || "en");
      return fetchJson(url, request, origin, "no-store");
    }

    if (type === "directions") {
      const originPoint = q.get("origin");
      const destinationPoint = q.get("destination");
      if (!originPoint || !destinationPoint) return json(400, { error: "origin and destination are required" });
      const url = withApiKey(new URL("https://api.olamaps.io/routing/v1/directions"), apiKey);
      url.searchParams.set("origin", originPoint);
      url.searchParams.set("destination", destinationPoint);
      url.searchParams.set("mode", q.get("mode") || "driving");
      url.searchParams.set("alternatives", q.get("alternatives") || "false");
      url.searchParams.set("steps", q.get("steps") || "false");
      url.searchParams.set("overview", q.get("overview") || "full");
      return fetchJson(url, request, origin, "no-store");
    }

    return json(400, { error: `Unsupported Ola Maps proxy type: ${type}` });
  } catch (error) {
    return json(500, { error: error.message || "Ola Maps proxy failed" });
  }
}
