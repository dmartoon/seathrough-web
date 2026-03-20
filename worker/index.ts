export interface Env {
  APP_NAME?: string;
  PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  ASSETS?: Fetcher;
}

type Region =
  | "southernCalifornia"
  | "northernCalifornia"
  | "hawaii"
  | "florida"
  | "gulfCoast"
  | "pacificNorthwest"
  | "eastCoast";

type TidePrediction = {
  t: string;
  v: string;
};

type BuoyData = {
  waveHeightM: number;
  wavePeriodSec: number;
  windSpeedKt: number;
  windDirectionDeg: number;
  waterTempF: number | null;
};

type CurrentWind = {
  speedKt: number;
  directionDeg: number;
};

type HourlyForecastPoint = {
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

type OpenMeteoMergedPayload = {
  hourly: Array<{
    timeIso: string;
    waveHeightFt: number | null;
    wavePeriodSec: number | null;
    waveDirectionDeg: number | null;
    waterTempF: number | null;
    windSpeedKt: number | null;
    windDirectionDeg: number | null;
  }>;
  timezone: string;
};

type SunTimesByDay = Record<
  string,
  {
    sunriseIso: string;
    sunsetIso: string;
  }
>;

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

function roundTo(value: number, digits: number) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatUtcBeginDate(date: Date) {
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join("") + ` ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function normalizeIsoMinute(value: string) {
  const normalized = value.trim();
  return normalized.endsWith("Z") ? normalized : `${normalized}:00Z`;
}

function normalizeNoaaTimeToIso(value: string) {
  const trimmed = value.trim();
  const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return withT.endsWith("Z") ? withT : `${withT}:00Z`;
}

function hourKeyFromIso(iso: string) {
  return normalizeIsoMinute(iso).slice(0, 13) + ":00:00Z";
}

function dayKeyFromIso(iso: string) {
  return normalizeIsoMinute(iso).slice(0, 10);
}

function cardinalDirectionFromDegrees(degrees: number) {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return dirs[index] ?? "N";
}

function parseNumberParam(value: string | null, label: string) {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}`);
  }

  return parsed;
}

function parseStringParam(value: string | null, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing ${label}`);
  }

  return trimmed;
}

function defaultBaseVisFt(region: Region) {
  switch (region) {
    case "southernCalifornia":
      return 30;
    case "northernCalifornia":
      return 20;
    case "hawaii":
      return 30;
    case "florida":
      return 25;
    case "gulfCoast":
      return 10;
    case "pacificNorthwest":
      return 10;
    case "eastCoast":
      return 15;
    default:
      return 20;
  }
}

const VisibilityModel = {
  waveEmaAlpha: 0.25,
  waveStart: 0.5,
  waveWorst: 6.0,
  waveCap: 26.0,
  waveShape: 0.75,
  windThreshold: 10.0,
  windCoef: 0.1,
  tideSlopeCoef: 0.4,
  tideAdjMax: 0.5,

  normalizedWaveIndex(heightFt: number, periodSec: number) {
    const safePeriod = Math.max(periodSec, 1.0);
    const periodFactor = Math.sqrt(safePeriod / 10.0);
    return Math.max(0.0, heightFt) * periodFactor;
  },

  angleDiffDeg(a: number, b: number) {
    let diff = (a - b) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    return Math.abs(diff);
  },

  onshoreComponent(windDirDeg: number, onshoreWindDirDeg: number) {
    const delta = this.angleDiffDeg(windDirDeg, onshoreWindDirDeg);
    const onshoreCos = Math.cos((delta * Math.PI) / 180);
    return Math.max(0, onshoreCos);
  },

  wavePenalty(waveIndex: number) {
    const x = Math.max(0.0, waveIndex);

    if (x <= this.waveStart) return 0.0;
    if (x >= this.waveWorst) return this.waveCap;

    let t = (x - this.waveStart) / (this.waveWorst - this.waveStart);
    t = Math.pow(t, this.waveShape);
    const smooth = t * t * (3.0 - 2.0 * t);

    return this.waveCap * smooth;
  },

  bucket(visFt: number) {
    const value = clamp(visFt, 0.0, 35.0);
    if (value >= 30.0) {
      return {
        ft: value,
        minFt: 30,
        maxFt: 35,
        label: "30+ ft",
      };
    }

    const lower = Math.floor(value / 5.0) * 5.0;
    const upper = lower + 5.0;

    return {
      ft: value,
      minFt: lower,
      maxFt: upper,
      label: `${Math.round(lower)}–${Math.round(upper)} ft`,
    };
  },

  tideAdjustmentContinuous(prev: number | null, now: number | null, next: number | null) {
    if (now === null) return 0.0;

    let slope = 0.0;
    if (prev !== null && next !== null) {
      slope = (next - prev) / 2.0;
    } else if (next !== null) {
      slope = next - now;
    } else if (prev !== null) {
      slope = now - prev;
    }

    return clamp(this.tideSlopeCoef * slope, -this.tideAdjMax, this.tideAdjMax);
  },

  estimatedVisibilityFt(params: {
    waveHeightFt: number;
    wavePeriodSec: number;
    windSpeedKt: number;
    windDirectionDeg: number;
    tideAdjFt: number;
    onshoreWindDirDeg: number;
    baseVisFt: number;
  }) {
    const waveIndex = this.normalizedWaveIndex(params.waveHeightFt, params.wavePeriodSec);
    const onshore = this.onshoreComponent(params.windDirectionDeg, params.onshoreWindDirDeg);
    const windExcess = Math.max(0.0, params.windSpeedKt - this.windThreshold);

    let vis = params.baseVisFt;
    vis -= this.wavePenalty(waveIndex);
    vis -= this.windCoef * windExcess * onshore;
    vis += params.tideAdjFt;

    return clamp(vis, 0.0, 35.0);
  },
};

async function fetchJson<T>(url: URL) {
  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": "SeaThrough Web Worker",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url.hostname}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: URL) {
  const response = await fetch(url.toString(), {
    headers: {
      accept: "text/plain,text/html;q=0.9,*/*;q=0.8",
      "user-agent": "SeaThrough Web Worker",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url.hostname}`);
  }

  return response.text();
}

async function fetchTides(stationId: string, rangeHours: number) {
  const clampedHours = clamp(rangeHours, 1, 24 * 16);
  const beginDate = formatUtcBeginDate(new Date());

  const url = new URL("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter");
  url.searchParams.set("product", "predictions");
  url.searchParams.set("station", stationId);
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("units", "english");
  url.searchParams.set("format", "json");
  url.searchParams.set("interval", "h");
  url.searchParams.set("begin_date", beginDate);
  url.searchParams.set("range", String(clampedHours));

  const payload = await fetchJson<{ predictions?: TidePrediction[]; error?: { message?: string } }>(url);

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  if (!payload.predictions?.length) {
    throw new Error("NOAA returned no tide predictions.");
  }

  return payload.predictions;
}

async function fetchBuoyData(buoyId: string): Promise<BuoyData> {
  const url = new URL(`https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`);
  const text = await fetchText(url);

  const allLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLines = allLines.filter((line) => !line.startsWith("#"));
  if (!dataLines.length) {
    throw new Error("NOAA buoy feed returned no rows.");
  }

  const splitColumns = (line: string) => line.split(/\s+/).map((part) => part.trim());

  let wdirIndex = 5;
  let wspdIndex = 6;
  let wvhtIndex = 8;
  let dpdIndex = 9;
  let wtmpIndex = 15;

  const headerLine = allLines.find(
    (line) => line.startsWith("#") && line.includes("WDIR") && line.includes("WSPD"),
  );

  if (headerLine) {
    const headerCols = splitColumns(headerLine.replace(/^#+/, ""));
    const indexOf = (name: string, fallback: number) => {
      const found = headerCols.indexOf(name);
      return found >= 0 ? found : fallback;
    };

    wdirIndex = indexOf("WDIR", wdirIndex);
    wspdIndex = indexOf("WSPD", wspdIndex);
    wvhtIndex = indexOf("WVHT", wvhtIndex);
    dpdIndex = indexOf("DPD", dpdIndex);
    wtmpIndex = indexOf("WTMP", wtmpIndex);
  }

  let windDirectionDeg = 0;
  let windSpeedKt = 0;
  let waveHeightM = 0;
  let wavePeriodSec = 0;
  let waterTempF: number | null = null;

  for (const line of dataLines.slice(0, 36)) {
    const cols = splitColumns(line);

    if (
      cols.length > Math.max(wdirIndex, wspdIndex) &&
      windSpeedKt === 0 &&
      Number.isFinite(Number(cols[wdirIndex])) &&
      Number.isFinite(Number(cols[wspdIndex]))
    ) {
      windDirectionDeg = Number(cols[wdirIndex]);
      windSpeedKt = Number(cols[wspdIndex]);
    }

    if (
      cols.length > Math.max(wvhtIndex, dpdIndex) &&
      waveHeightM === 0 &&
      Number.isFinite(Number(cols[wvhtIndex])) &&
      Number(cols[wvhtIndex]) > 0
    ) {
      waveHeightM = Number(cols[wvhtIndex]);
      wavePeriodSec = Number(cols[dpdIndex]) || 0;
    }

    if (cols.length > wtmpIndex && waterTempF === null && Number.isFinite(Number(cols[wtmpIndex]))) {
      const tempC = Number(cols[wtmpIndex]);
      waterTempF = tempC * (9 / 5) + 32;
    }

    if (windSpeedKt > 0 && waveHeightM > 0 && waterTempF !== null) {
      break;
    }
  }

  return {
    waveHeightM,
    wavePeriodSec,
    windSpeedKt,
    windDirectionDeg,
    waterTempF,
  };
}

async function fetchCurrentWind(latitude: number, longitude: number): Promise<CurrentWind | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "wind_speed_10m,wind_direction_10m");
  url.searchParams.set("windspeed_unit", "kn");
  url.searchParams.set("timezone", "GMT");

  const payload = await fetchJson<{
    current?: {
      wind_speed_10m?: number;
      wind_direction_10m?: number;
    };
  }>(url);

  const speed = payload.current?.wind_speed_10m;
  const direction = payload.current?.wind_direction_10m;

  if (!Number.isFinite(speed) || !Number.isFinite(direction)) {
    return null;
  }

  return {
    speedKt: Number(speed),
    directionDeg: Number(direction),
  };
}

async function fetchOpenMeteoHourlyForecast(
  latitude: number,
  longitude: number,
  forecastDays: number,
): Promise<OpenMeteoMergedPayload> {
  const days = clamp(forecastDays, 1, 16);

  const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
  marineUrl.searchParams.set("latitude", String(latitude));
  marineUrl.searchParams.set("longitude", String(longitude));
  marineUrl.searchParams.set(
    "hourly",
    "wave_height,wave_period,wave_direction,sea_surface_temperature",
  );
  marineUrl.searchParams.set("forecast_days", String(days));
  marineUrl.searchParams.set("length_unit", "imperial");
  marineUrl.searchParams.set("cell_selection", "sea");
  marineUrl.searchParams.set("timezone", "GMT");

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m");
  weatherUrl.searchParams.set("forecast_days", String(days));
  weatherUrl.searchParams.set("windspeed_unit", "kn");
  weatherUrl.searchParams.set("timezone", "GMT");

  const [marine, weather] = await Promise.all([
    fetchJson<{
      hourly?: {
        time?: string[];
        wave_height?: Array<number | null>;
        wave_period?: Array<number | null>;
        wave_direction?: Array<number | null>;
        sea_surface_temperature?: Array<number | null>;
      };
      timezone?: string;
      error?: boolean;
      reason?: string;
    }>(marineUrl),
    fetchJson<{
      hourly?: {
        time?: string[];
        wind_speed_10m?: Array<number | null>;
        wind_direction_10m?: Array<number | null>;
      };
      timezone?: string;
      error?: boolean;
      reason?: string;
    }>(weatherUrl),
  ]);

  if (marine.error) {
    throw new Error(marine.reason ?? "Open-Meteo marine request failed.");
  }

  if (weather.error) {
    throw new Error(weather.reason ?? "Open-Meteo weather request failed.");
  }

  const times = marine.hourly?.time ?? [];
  if (!times.length) {
    throw new Error("Open-Meteo returned no hourly marine data.");
  }

  const waveHeight = marine.hourly?.wave_height ?? [];
  const wavePeriod = marine.hourly?.wave_period ?? [];
  const waveDirection = marine.hourly?.wave_direction ?? [];
  const seaSurfaceTemperature = marine.hourly?.sea_surface_temperature ?? [];
  const windSpeed = weather.hourly?.wind_speed_10m ?? [];
  const windDirection = weather.hourly?.wind_direction_10m ?? [];

  return {
    hourly: times.map((time, index) => ({
      timeIso: normalizeIsoMinute(time),
      waveHeightFt: waveHeight[index] ?? null,
      wavePeriodSec: wavePeriod[index] ?? null,
      waveDirectionDeg: waveDirection[index] ?? null,
      waterTempF: seaSurfaceTemperature[index] ?? null,
      windSpeedKt: windSpeed[index] ?? null,
      windDirectionDeg: windDirection[index] ?? null,
    })),
    timezone: marine.timezone ?? weather.timezone ?? "GMT",
  };
}

async function fetchSunTimes(
  latitude: number,
  longitude: number,
  forecastDays: number,
): Promise<SunTimesByDay> {
  const days = clamp(forecastDays, 1, 16);

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("forecast_days", String(days));
  url.searchParams.set("timezone", "GMT");

  const payload = await fetchJson<{
    daily?: {
      time?: string[];
      sunrise?: string[];
      sunset?: string[];
    };
    error?: boolean;
    reason?: string;
  }>(url);

  if (payload.error) {
    throw new Error(payload.reason ?? "Open-Meteo sun times request failed.");
  }

  const daysList = payload.daily?.time ?? [];
  const sunriseList = payload.daily?.sunrise ?? [];
  const sunsetList = payload.daily?.sunset ?? [];

  const out: SunTimesByDay = {};
  const count = Math.min(daysList.length, sunriseList.length, sunsetList.length);

  for (let index = 0; index < count; index += 1) {
    const dayKey = daysList[index];
    const sunriseIso = normalizeIsoMinute(sunriseList[index]);
    const sunsetIso = normalizeIsoMinute(sunsetList[index]);
    out[dayKey] = { sunriseIso, sunsetIso };
  }

  return out;
}

function tideHeightByHour(predictions: TidePrediction[]) {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const prediction of predictions) {
    const height = Number(prediction.v);
    if (!Number.isFinite(height)) continue;

    const key = hourKeyFromIso(normalizeNoaaTimeToIso(prediction.t));
    const current = buckets.get(key) ?? { sum: 0, count: 0 };
    buckets.set(key, {
      sum: current.sum + height,
      count: current.count + 1,
    });
  }

  const result = new Map<string, number>();
  for (const [key, value] of buckets.entries()) {
    result.set(key, value.sum / Math.max(1, value.count));
  }

  return result;
}

function tideAdjustmentFt(trend: string) {
  switch (trend.toLowerCase()) {
    case "rising":
      return 2.0;
    case "falling":
      return -2.0;
    default:
      return 0.0;
  }
}

function applyVisibility(params: {
  hours: OpenMeteoMergedPayload["hourly"];
  tideByHour: Map<string, number>;
  baseVisFt: number;
  onshoreWindDirDeg: number;
}) {
  const sorted = [...params.hours].sort((left, right) =>
    left.timeIso.localeCompare(right.timeIso),
  );

  const tideHeights = sorted.map((hour) => params.tideByHour.get(hourKeyFromIso(hour.timeIso)) ?? null);

  let ema: number | null = null;
  let lastDayKey: string | null = null;

  return sorted.map((hour, index): HourlyForecastPoint => {
    const dayKey = dayKeyFromIso(hour.timeIso);
    if (lastDayKey && dayKey !== lastDayKey) {
      ema = null;
    }
    lastDayKey = dayKey;

    const tideNow = tideHeights[index] ?? null;
    const tidePrev = index > 0 ? (tideHeights[index - 1] ?? null) : null;
    const tideNext = index + 1 < tideHeights.length ? (tideHeights[index + 1] ?? null) : null;
    const tideAdj = VisibilityModel.tideAdjustmentContinuous(tidePrev, tideNow, tideNext);

    if (
      hour.waveHeightFt !== null &&
      hour.wavePeriodSec !== null &&
      hour.windSpeedKt !== null &&
      hour.windDirectionDeg !== null
    ) {
      const waveIndex = VisibilityModel.normalizedWaveIndex(
        hour.waveHeightFt,
        hour.wavePeriodSec,
      );
      ema = ema === null ? waveIndex : VisibilityModel.waveEmaAlpha * waveIndex + (1 - VisibilityModel.waveEmaAlpha) * ema;
    }

    if (
      ema === null ||
      hour.windSpeedKt === null ||
      hour.windDirectionDeg === null
    ) {
      return {
        timeIso: hour.timeIso,
        waveHeightFt: hour.waveHeightFt,
        wavePeriodSec: hour.wavePeriodSec,
        waveDirectionDeg: hour.waveDirectionDeg,
        waterTempF: hour.waterTempF,
        windSpeedKt: hour.windSpeedKt,
        windDirectionDeg: hour.windDirectionDeg,
        tideHeightFt: tideNow,
        predictedClarityFt: null,
        predictedClarityMinFt: null,
        predictedClarityMaxFt: null,
        predictedClarityLabel: null,
      };
    }

    const onshore = VisibilityModel.onshoreComponent(
      hour.windDirectionDeg,
      params.onshoreWindDirDeg,
    );
    const windExcess = Math.max(0.0, hour.windSpeedKt - VisibilityModel.windThreshold);

    let vis = params.baseVisFt;
    vis -= VisibilityModel.wavePenalty(ema);
    vis -= VisibilityModel.windCoef * windExcess * onshore;
    vis += tideAdj;
    vis = clamp(vis, 0.0, 35.0);

    const bucket = VisibilityModel.bucket(vis);

    return {
      timeIso: hour.timeIso,
      waveHeightFt: hour.waveHeightFt,
      wavePeriodSec: hour.wavePeriodSec,
      waveDirectionDeg: hour.waveDirectionDeg,
      waterTempF: hour.waterTempF,
      windSpeedKt: hour.windSpeedKt,
      windDirectionDeg: hour.windDirectionDeg,
      tideHeightFt: tideNow,
      predictedClarityFt: roundTo(bucket.ft, 1),
      predictedClarityMinFt: bucket.minFt,
      predictedClarityMaxFt: bucket.maxFt,
      predictedClarityLabel: bucket.label,
    };
  });
}

async function buildForecastResponse(requestUrl: URL) {
  const latitude = parseNumberParam(requestUrl.searchParams.get("latitude"), "latitude");
  const longitude = parseNumberParam(requestUrl.searchParams.get("longitude"), "longitude");
  const buoyId = parseStringParam(requestUrl.searchParams.get("buoyId"), "buoyId");
  const tideStation = parseStringParam(requestUrl.searchParams.get("tideStation"), "tideStation");
  const shoreDirection = parseNumberParam(
    requestUrl.searchParams.get("shoreDirection"),
    "shoreDirection",
  );
  const region = parseStringParam(requestUrl.searchParams.get("region"), "region") as Region;
  const days = clamp(Number(requestUrl.searchParams.get("days") ?? 10), 1, 10);

  const [buoy, tides, hourlyOpenMeteo, sunTimes, liveWind] = await Promise.all([
    fetchBuoyData(buoyId),
    fetchTides(tideStation, days * 24),
    fetchOpenMeteoHourlyForecast(latitude, longitude, days),
    fetchSunTimes(latitude, longitude, days),
    fetchCurrentWind(latitude, longitude).catch(() => null),
  ]);

  const firstTide = tides[0];
  const nextTide = tides[1];
  if (!firstTide || !nextTide) {
    throw new Error("Not enough tide points returned for snapshot forecast.");
  }

  const firstHeight = Number(firstTide.v);
  const nextHeight = Number(nextTide.v);
  if (!Number.isFinite(firstHeight) || !Number.isFinite(nextHeight)) {
    throw new Error("NOAA returned invalid tide heights.");
  }

  const tideTrend = nextHeight > firstHeight ? "Rising" : nextHeight < firstHeight ? "Falling" : "Steady";
  const windSpeedKt = liveWind?.speedKt ?? buoy.windSpeedKt;
  const windDirectionDeg = liveWind?.directionDeg ?? buoy.windDirectionDeg;
  const waveHeightFt = roundTo(buoy.waveHeightM * 3.28084, 1);
  const wavePeriodSec = roundTo(buoy.wavePeriodSec, 0);
  const baseVisFt = defaultBaseVisFt(region);
  const clarityFt = VisibilityModel.estimatedVisibilityFt({
    waveHeightFt,
    wavePeriodSec,
    windSpeedKt,
    windDirectionDeg,
    tideAdjFt: tideAdjustmentFt(tideTrend),
    onshoreWindDirDeg: shoreDirection,
    baseVisFt,
  });
  const currentBucket = VisibilityModel.bucket(clarityFt);

  const hourly = applyVisibility({
    hours: hourlyOpenMeteo.hourly,
    tideByHour: tideHeightByHour(tides),
    baseVisFt,
    onshoreWindDirDeg: shoreDirection,
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    timezone: hourlyOpenMeteo.timezone,
    current: {
      buoyLabel: `Using NOAA buoy ${buoyId}`,
      waveHeightFt,
      wavePeriodSec,
      tideHeightFt: roundTo(firstHeight, 1),
      tideDirection: tideTrend,
      windSpeedKt: roundTo(windSpeedKt, 0),
      windDirectionDeg: roundTo(windDirectionDeg, 0),
      windDirectionCardinal: cardinalDirectionFromDegrees(windDirectionDeg),
      waterTempF: buoy.waterTempF === null ? null : roundTo(buoy.waterTempF, 0),
      clarityFt: roundTo(currentBucket.ft, 1),
      clarityRange: currentBucket.label,
      clarityLabel: currentBucket.label,
    },
    hourly,
    sunTimesByDay: sunTimes,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: env.APP_NAME ?? "SeaThrough",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/config") {
      return json({
        appName: env.APP_NAME ?? "SeaThrough",
        publicGoogleMapsApiKey: env.PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      });
    }

    if (url.pathname === "/api/forecast") {
      try {
        return json(await buildForecastResponse(url));
      } catch (error) {
        return json(
          {
            ok: false,
            message: error instanceof Error ? error.message : "Forecast request failed.",
          },
          { status: 500 },
        );
      }
    }

    const assets = env.ASSETS;

    if (!assets) {
      return new Response(
        "ASSETS binding is missing. Check wrangler.jsonc assets.binding.",
        { status: 500 },
      );
    }

    return assets.fetch(request);
  },
} satisfies ExportedHandler<Env>;
