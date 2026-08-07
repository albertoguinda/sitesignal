import { env } from "../env";
import type {
  AmbientSummary,
  Site,
  WeatherCurrent,
  WeatherForecastPoint,
} from "../../shared/types";

/** WMO 4677 weather codes, collapsed to the labels an operator cares about. */
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODES[code] ?? "Unknown conditions";
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    weather_code?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    precipitation_probability?: (number | null)[];
  };
}

interface CacheEntry {
  payload: { current: WeatherCurrent; forecast: WeatherForecastPoint[] };
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
/** Collapses concurrent misses for the same coordinates into one upstream call. */
const inFlight = new Map<string, Promise<CacheEntry>>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function buildUrl(lat: number, lng: number): string {
  const url = new URL(env.WEATHER_BASE_URL);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,precipitation_probability",
  );
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  return url.toString();
}

function parse(response: OpenMeteoResponse): CacheEntry["payload"] {
  const current = response.current ?? {};
  const code = current.weather_code ?? 0;

  const hourly = response.hourly ?? {};
  const times = hourly.time ?? [];
  const nowMs = Date.now();

  const forecast: WeatherForecastPoint[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i];
    if (!time) continue;
    // Open-Meteo returns local wall-clock times for the whole window, including
    // hours already past; only forward-looking points are useful here.
    if (new Date(time).getTime() < nowMs - 3_600_000) continue;
    forecast.push({
      t: time,
      temperature: hourly.temperature_2m?.[i] ?? 0,
      humidity: hourly.relative_humidity_2m?.[i] ?? 0,
      precipitationProbability: hourly.precipitation_probability?.[i] ?? 0,
    });
    if (forecast.length >= 24) break;
  }

  return {
    current: {
      temperature: current.temperature_2m ?? 0,
      humidity: current.relative_humidity_2m ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      precipitation: current.precipitation ?? 0,
      weatherCode: code,
      description: describeWeatherCode(code),
      isDay: current.is_day !== 0,
      time: current.time ?? new Date().toISOString(),
    },
    forecast,
  };
}

async function fetchUpstream(lat: number, lng: number): Promise<CacheEntry> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(buildUrl(lat, lng), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo responded ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as OpenMeteoResponse;
    return { payload: parse(body), fetchedAt: Date.now() };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Cached ambient conditions for one coordinate pair.
 *
 * Cache window is `WEATHER_CACHE_MINUTES` (15 by default). On upstream failure
 * an expired entry is still served, flagged `stale`, so a network blip degrades
 * the panel instead of breaking the page.
 */
export async function getAmbient(site: Site): Promise<AmbientSummary | null> {
  const key = cacheKey(site.lat, site.lng);
  const cached = cache.get(key);
  const isFresh = cached && Date.now() - cached.fetchedAt < env.weatherCacheMs;

  if (cached && isFresh) return toSummary(site, cached, false);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetchUpstream(site.lat, site.lng).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    const entry = await pending;
    cache.set(key, entry);
    return toSummary(site, entry, false);
  } catch (error) {
    console.warn(`[weather] ${site.name}: ${(error as Error).message}`);
    return cached ? toSummary(site, cached, true) : null;
  }
}

function toSummary(site: Site, entry: CacheEntry, stale: boolean): AmbientSummary {
  return {
    siteId: site.id,
    siteName: site.name,
    timezone: site.timezone,
    current: entry.payload.current,
    forecast: entry.payload.forecast,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    stale,
  };
}

/** Ambient conditions for many sites at once; failures drop out silently. */
export async function getAmbientForSites(sites: Site[]): Promise<AmbientSummary[]> {
  const results = await Promise.all(sites.map((site) => getAmbient(site)));
  return results.filter((entry): entry is AmbientSummary => entry !== null);
}
