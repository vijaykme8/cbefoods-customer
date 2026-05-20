/* routepickup2: route helper used with pickup-only road routing.
   Straight-line fallback is hidden in the UI; this parser tries multiple Ola route response shapes.

   =========================================================
   CBE Foods Ola Maps V4 shared helper
   Swiggy-like map behavior foundation:
   - Direct Ola map tiles in browser for speed
   - Cloudflare Pages Function only for reverse/directions/config
   - MapLibre loader
========================================================= */
(function () {
  const PROXY_URL = "/ola-maps";
  const OLA_STYLE_BASE_URL = "https://api.olamaps.io/tiles/vector/v1/styles";
  const OLA_STYLE_NAMES = {
    light: "default-light-standard",
    dark: "default-dark-standard"
  };

  function getMapTheme() {
    const value = clean(window.CBE_OLA_MAP_THEME || window.CBE_OLA_THEME || "dark").toLowerCase();
    return value === "light" ? "light" : "dark";
  }

  function getStyleUrlForTheme(theme) {
    const styleName = OLA_STYLE_NAMES[theme] || OLA_STYLE_NAMES.dark;
    return `${OLA_STYLE_BASE_URL}/${styleName}/style.json`;
  }
  let mapLibrePromise = null;
  let browserKeyPromise = null;
  const ROUTE_CACHE = new Map();


  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function isOlaUrl(rawUrl) {
    const url = String(rawUrl || "");
    return url.includes("olamaps.io") || url.includes("olakrutrim.com");
  }

  async function getBrowserKey() {
    if (window.CBE_OLA_BROWSER_API_KEY) {
      return clean(window.CBE_OLA_BROWSER_API_KEY);
    }

    if (browserKeyPromise) return browserKeyPromise;

    browserKeyPromise = fetch(`${PROXY_URL}?type=config`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(`Ola config failed: ${response.status}`);
        const data = await response.json();
        const key = clean(data.apiKey || data.olaMapsApiKey || data.key);
        if (!key) throw new Error("Ola browser key missing from config response");
        window.CBE_OLA_BROWSER_API_KEY = key;
        return key;
      });

    return browserKeyPromise;
  }

  function withApiKey(rawUrl, apiKey) {
    try {
      const url = new URL(rawUrl);
      if (isOlaUrl(url.href) && apiKey && !url.searchParams.get("api_key")) {
        url.searchParams.set("api_key", apiKey);
      }
      return url.toString();
    } catch (_) {
      return rawUrl;
    }
  }

  async function styleUrl() {
    const apiKey = await getBrowserKey();
    return withApiKey(getStyleUrlForTheme(getMapTheme()), apiKey);
  }

  async function transformRequest(url) {
    const apiKey = await getBrowserKey();
    return { url: withApiKey(url, apiKey) };
  }

  function transformRequestSync(url) {
    const apiKey = clean(window.CBE_OLA_BROWSER_API_KEY);
    return { url: withApiKey(url, apiKey) };
  }

  function loadMapLibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (mapLibrePromise) return mapLibrePromise;

    mapLibrePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-cbe-maplibre="true"]') || document.querySelector('script[data-maplibre="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.maplibregl));
        existing.addEventListener("error", () => reject(new Error("MapLibre failed to load")));
        if (window.maplibregl) resolve(window.maplibregl);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.js";
      script.async = true;
      script.defer = true;
      script.dataset.cbeMaplibre = "true";
      script.onload = () => resolve(window.maplibregl);
      script.onerror = () => reject(new Error("MapLibre failed to load"));
      document.head.appendChild(script);
    });

    return mapLibrePromise;
  }


  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function normalizePoint(source) {
    if (!source || typeof source !== "object") return null;
    const lat = toNumber(source.lat ?? source.latitude);
    const lng = toNumber(source.lng ?? source.lon ?? source.long ?? source.longitude);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  }

  function decodePolyline(str, precision = 5) {
    if (!str || typeof str !== "string") return [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];
    const factor = Math.pow(10, precision);

    while (index < str.length) {
      let result = 0;
      let shift = 0;
      let byte;

      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < str.length);

      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      result = 0;
      shift = 0;

      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < str.length);

      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      coordinates.push([lng / factor, lat / factor]);
    }

    return coordinates.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }

  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function formatDistance(meters) {
    const value = Number(meters || 0);
    if (!Number.isFinite(value) || value <= 0) return "—";
    if (value < 1000) return `${Math.round(value)} m`;
    return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} km`;
  }

  function formatDuration(seconds) {
    const value = Number(seconds || 0);
    if (!Number.isFinite(value) || value <= 0) return "—";
    const mins = Math.max(1, Math.round(value / 60));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }

  function getNumberFromDistance(value) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "object") return Number(value.value ?? value.distance ?? value.meters ?? 0) || 0;
    return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
  }

  function getNumberFromDuration(value) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "object") return Number(value.value ?? value.duration ?? value.seconds ?? 0) || 0;
    return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
  }

  function looksLikeIndiaLatLng(a, b) {
    return a >= 5 && a <= 40 && b >= 65 && b <= 100;
  }

  function looksLikeLngLat(a, b) {
    return a >= 65 && a <= 100 && b >= 5 && b <= 40;
  }

  function normalizeCoordinatePair(a, b) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    // Ola responses may return either [lat,lng] or [lng,lat].
    // MapLibre requires [lng,lat]. For Tamil Nadu/India, detect the order safely.
    if (looksLikeIndiaLatLng(x, y)) return [y, x];
    if (looksLikeLngLat(x, y)) return [x, y];

    // Generic fallback: if first value is latitude-ish and second longitude-ish, swap.
    if (Math.abs(x) <= 90 && Math.abs(y) <= 180 && Math.abs(y) > 45) return [y, x];
    return [x, y];
  }

  function collectCoordinatesFromGeoJson(obj) {
    if (!obj || typeof obj !== "object") return [];
    if (obj.type === "LineString" && Array.isArray(obj.coordinates)) return normalizeCoordinateList(obj.coordinates);
    if (obj.type === "MultiLineString" && Array.isArray(obj.coordinates)) return normalizeCoordinateList(obj.coordinates.flat());
    if (obj.type === "Feature" && obj.geometry) return collectCoordinatesFromGeoJson(obj.geometry);
    if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
      return obj.features.flatMap(feature => collectCoordinatesFromGeoJson(feature));
    }
    return [];
  }

  function collectCoordinateArraysDeep(value, depth = 0) {
    if (!value || depth > 8) return [];

    if (Array.isArray(value)) {
      if (value.length >= 2 && typeof value[0] !== "object" && typeof value[1] !== "object") {
        const pair = normalizeCoordinatePair(value[0], value[1]);
        return pair ? [pair] : [];
      }
      return value.flatMap(item => collectCoordinateArraysDeep(item, depth + 1));
    }

    if (typeof value === "object") {
      if (("lat" in value || "latitude" in value) && ("lng" in value || "lon" in value || "long" in value || "longitude" in value)) {
        const point = normalizePoint(value);
        return point ? [[point.lng, point.lat]] : [];
      }

      const priorityKeys = [
        "coordinates",
        "points",
        "path",
        "polyline_points",
        "route_points",
        "overview_path",
        "geometry",
        "geojson"
      ];

      for (const key of priorityKeys) {
        if (key in value) {
          const found = collectCoordinateArraysDeep(value[key], depth + 1);
          if (found.length >= 2) return found;
        }
      }

      return Object.values(value).flatMap(item => collectCoordinateArraysDeep(item, depth + 1));
    }

    return [];
  }

  function collectEncodedPolylineStrings(value, depth = 0) {
    if (!value || depth > 8) return [];
    if (typeof value === "string") {
      // Encoded polylines are compact and usually contain many non-alphanumeric chars.
      // Avoid treating normal text/status strings as polylines.
      if (value.length >= 12 && /[\\_@?`~|{}\\[\\]\\^]/.test(value)) return [value];
      return [];
    }
    if (Array.isArray(value)) return value.flatMap(item => collectEncodedPolylineStrings(item, depth + 1));
    if (typeof value === "object") {
      const keys = ["points", "polyline", "encodedPolyline", "overview_polyline", "overviewPolyline", "geometry"];
      const out = [];
      for (const key of keys) {
        if (key in value) out.push(...collectEncodedPolylineStrings(value[key], depth + 1));
      }
      if (out.length) return out;
      return Object.values(value).flatMap(item => collectEncodedPolylineStrings(item, depth + 1));
    }
    return [];
  }

  function normalizeCoordinateList(coords) {
    if (!Array.isArray(coords)) return [];
    return coords
      .map(point => {
        if (Array.isArray(point)) return normalizeCoordinatePair(point[0], point[1]) || [NaN, NaN];
        if (point && typeof point === "object") {
          const normalized = normalizePoint(point);
          return normalized ? [normalized.lng, normalized.lat] : [NaN, NaN];
        }
        return [NaN, NaN];
      })
      .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }

  function fallbackCoordinates(origin, destination) {
    return [[origin.lng, origin.lat], [destination.lng, destination.lat]];
  }

  function extractRouteData(data, originInput, destinationInput) {
    const origin = normalizePoint(originInput);
    const destination = normalizePoint(destinationInput);
    const fallbackCoords = origin && destination ? fallbackCoordinates(origin, destination) : [];
    const routes = data?.routes || data?.data?.routes || data?.result?.routes || data?.route || data?.data?.route || [];
    const route = Array.isArray(routes) ? routes[0] : routes;
    let coords = [];
    let distanceMeters = 0;
    let durationSeconds = 0;

    const directEncoded =
      route?.overview_polyline?.points ||
      route?.overviewPolyline?.points ||
      route?.overview_polyline ||
      route?.overviewPolyline ||
      route?.polyline ||
      route?.encodedPolyline ||
      route?.geometry;

    if (typeof directEncoded === "string") {
      coords = decodePolyline(directEncoded, 5);
      if (!coords.length) coords = decodePolyline(directEncoded, 6);
    }

    if (!coords.length) {
      coords = collectCoordinatesFromGeoJson(route?.geometry || route?.geojson || route?.routeGeoJson || data?.geometry || data?.geojson);
    }

    if (!coords.length) {
      coords = normalizeCoordinateList(collectCoordinateArraysDeep(route || data));
    }

    const legs = Array.isArray(route?.legs) ? route.legs : [];
    if (!coords.length && legs.length) {
      const stepCoords = [];
      legs.forEach(leg => {
        (leg.steps || []).forEach(step => {
          const encoded = step.polyline?.points || step.polyline || step.encodedPolyline || step.geometry;
          if (typeof encoded === "string") {
            stepCoords.push(...decodePolyline(encoded, 5));
            if (!stepCoords.length) stepCoords.push(...decodePolyline(encoded, 6));
          } else {
            stepCoords.push(...collectCoordinatesFromGeoJson(encoded));
            stepCoords.push(...collectCoordinateArraysDeep(encoded));
          }
        });
      });
      coords = stepCoords;
    }

    if (!coords.length) {
      const encodedList = collectEncodedPolylineStrings(route || data);
      for (const encoded of encodedList) {
        let decoded = decodePolyline(encoded, 5);
        if (decoded.length < 2) decoded = decodePolyline(encoded, 6);
        if (decoded.length >= 2) {
          coords = decoded;
          break;
        }
      }
    }

    if (legs.length) {
      distanceMeters = legs.reduce((sum, leg) => sum + getNumberFromDistance(leg.distance), 0);
      durationSeconds = legs.reduce((sum, leg) => sum + getNumberFromDuration(leg.duration), 0);
    }

    if (!distanceMeters) distanceMeters = getNumberFromDistance(route?.distance || route?.distanceMeters || route?.distance_meters || data?.distance);
    if (!durationSeconds) durationSeconds = getNumberFromDuration(route?.duration || route?.durationSeconds || route?.duration_seconds || data?.duration);
    if (!distanceMeters && origin && destination) distanceMeters = haversineMeters(origin, destination);
    if (!durationSeconds && distanceMeters) durationSeconds = Math.round(distanceMeters / 6.5);

    coords = normalizeCoordinateList(coords);
    const usedFallback = coords.length < 2;
    if (usedFallback) coords = fallbackCoords;

    return {
      coordinates: coords,
      fallback: usedFallback,
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds),
      raw: data
    };
  }

  function routeCacheKey(origin, destination) {
    return [origin.lat.toFixed(4), origin.lng.toFixed(4), destination.lat.toFixed(4), destination.lng.toFixed(4)].join(",");
  }

  async function getRoute(originInput, destinationInput) {
    const origin = normalizePoint(originInput);
    const destination = normalizePoint(destinationInput);
    if (!origin || !destination) return null;

    const key = routeCacheKey(origin, destination);
    if (ROUTE_CACHE.has(key)) return ROUTE_CACHE.get(key);

    const promise = directions(origin, destination)
      .then(data => extractRouteData(data, origin, destination))
      .catch(error => {
        const route = extractRouteData(null, origin, destination);
        route.fallback = true;
        route.error = error?.message || String(error || "Directions failed");
        return route;
      });

    ROUTE_CACHE.set(key, promise);
    const route = await promise;
    ROUTE_CACHE.set(key, route);
    return route;
  }

  async function createMap(options) {
    const maplibregl = await loadMapLibre();
    await getBrowserKey();
    const style = await styleUrl();

    const map = new maplibregl.Map({
      container: options.container,
      style,
      center: options.center,
      zoom: options.zoom || 16,
      attributionControl: false,
      transformRequest: transformRequestSync
    });

    if (options.controls !== false) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    }

    return { map, maplibregl };
  }

  async function reverse(point) {
    const response = await fetch(`${PROXY_URL}?type=reverse&lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`);
    if (!response.ok) throw new Error(`Reverse geocode failed: ${response.status}`);
    return response.json();
  }

  async function directions(origin, destination) {
    const url =
      `${PROXY_URL}?type=directions` +
      `&originLat=${encodeURIComponent(origin.lat)}` +
      `&originLng=${encodeURIComponent(origin.lng)}` +
      `&destLat=${encodeURIComponent(destination.lat)}` +
      `&destLng=${encodeURIComponent(destination.lng)}` +
      `&_=${Date.now()}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    if (!response.ok) throw new Error(`Directions failed: ${response.status}`);
    return response.json();
  }

  window.CBEOlaMapV4 = {
    createMap,
    loadMapLibre,
    getBrowserKey,
    reverse,
    directions,
    getRoute,
    extractRouteData,
    decodePolyline,
    formatDistance,
    formatDuration,
    withApiKey,
    PROXY_URL,
    getMapTheme
  };
})();
