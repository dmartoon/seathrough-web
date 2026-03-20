import type { PinnedSpot } from "../../domain/types";

export type ForecastApiCurrent = {
  buoyLabel: string;
  waveHeightFt: number;
  wavePeriodSec: number;
  tideHeightFt: number | null;
  tideDirection: "Rising" | "Falling" | "Steady";
  windSpeedKt: number;
  windDirectionDeg: number;
  windDirectionCardinal: string;
  waterTempF: number | null;
  clarityFt: number;
  clarityRange: string;
  clarityLabel: string;
};

export type ForecastApiHourlyPoint = {
  timeIso: string;
  waveHeightFt: number | null;
  wavePeriodSec: number | null;
  waveDirectionDeg: number | null;
  waterTempF: number | null;
  windSpeedKt: number | null;
  windDirectionDeg: number | null;
  tideHeightFt: number | null;
  predictedClarityFt: number | null;
  predictedClarityMinFt: number | null;
  predictedClarityMaxFt: number | null;
  predictedClarityLabel: string | null;
};

export type ForecastApiResponse = {
  ok: true;
  generatedAt: string;
  timezone: string;
  current: ForecastApiCurrent;
  hourly: ForecastApiHourlyPoint[];
  sunTimesByDay: Record<
    string,
    {
      sunriseIso: string;
      sunsetIso: string;
    }
  >;
};

type CacheEntry = {
  data?: ForecastApiResponse;
  promise?: Promise<ForecastApiResponse>;
  expiresAt: number;
};

const FORECAST_CACHE_TTL_MS = 5 * 60 * 1000;
const forecastCache = new Map<string, CacheEntry>();

function spotCacheKey(spot: PinnedSpot) {
  return [
    spot.id,
    spot.latitude.toFixed(5),
    spot.longitude.toFixed(5),
    spot.buoyId,
    spot.tideStation,
    spot.shoreDirection.toFixed(0),
    spot.region,
  ].join("|");
}

function buildForecastUrl(spot: PinnedSpot, days = 10) {
  const url = new URL("/api/forecast", window.location.origin);
  url.searchParams.set("latitude", String(spot.latitude));
  url.searchParams.set("longitude", String(spot.longitude));
  url.searchParams.set("buoyId", spot.buoyId);
  url.searchParams.set("tideStation", spot.tideStation);
  url.searchParams.set("shoreDirection", String(spot.shoreDirection));
  url.searchParams.set("region", spot.region);
  url.searchParams.set("days", String(days));
  return url;
}

export function readCachedForecast(spot: PinnedSpot) {
  const key = spotCacheKey(spot);
  const cached = forecastCache.get(key);

  if (!cached?.data) return null;
  if (cached.expiresAt <= Date.now()) return null;

  return cached.data;
}

export async function fetchSpotForecast(spot: PinnedSpot, days = 10) {
  const key = spotCacheKey(spot);
  const now = Date.now();
  const cached = forecastCache.get(key);

  if (cached?.data && cached.expiresAt > now) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetch(buildForecastUrl(spot, days).toString(), {
    cache: "no-store",
  })
    .then(async (response) => {
      const payload = (await response.json()) as ForecastApiResponse | { ok?: false; message?: string };

      if (!response.ok || payload.ok !== true) {
        throw new Error(
          "message" in payload && payload.message ? payload.message : `Forecast request failed: ${response.status}`,
        );
      }

      forecastCache.set(key, {
        data: payload,
        expiresAt: Date.now() + FORECAST_CACHE_TTL_MS,
      });

      return payload;
    })
    .catch((error) => {
      forecastCache.delete(key);
      throw error;
    });

  forecastCache.set(key, {
    promise,
    expiresAt: now + FORECAST_CACHE_TTL_MS,
  });

  return promise;
}
