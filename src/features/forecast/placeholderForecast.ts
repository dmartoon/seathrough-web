import type { PinnedSpot } from "../../domain/types";
import type { ForecastApiResponse } from "./forecastApi";

export type CurrentConditions = {
  buoyLabel: string;
  waveHeightFt: number;
  wavePeriodSec: number;
  tideHeightFt: number | null;
  tideDirection: "Rising" | "Falling" | "Slack" | "Steady";
  windDirection: string;
  windSpeedKt: number;
  waterTempF: number | null;
  clarityFt: number;
  clarityRange: string;
  clarityLabel: string;
};

export type ForecastDay = {
  key: string;
  label: string;
  date: Date;
};

export type HourlyForecastRow = {
  id: string;
  timeIso: string;
  hourLabel: string;
  waveText: string;
  tideText: string;
  tideDirection: "↗" | "↘" | "→";
  clarityFt: number;
  clarityLabel: string;
  clarityText: string;
  waterTempF: number | null;
  windText: string;
};

function stableSeed(spot: PinnedSpot) {
  const input = `${spot.id}:${spot.latitude.toFixed(4)}:${spot.longitude.toFixed(4)}:${spot.buoyId}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function seededUnit(seed: number, offset: number) {
  const raw = Math.sin(seed * 0.00037 + offset * 1.61803398875) * 43758.5453123;
  return raw - Math.floor(raw);
}

function roundTo(value: number, digits: number) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalDayKey(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatForecastClarityRange(value: number) {
  const clamped = Math.max(0, Math.min(35, value));

  if (clamped >= 30) {
    return "30+ ft";
  }

  const lower = Math.floor(clamped / 5) * 5;
  const upper = lower + 5;
  return `${lower}-${upper} ft`;
}


function parseClarityFeetFromLabel(label: string) {
  const normalized = label
    .replace(/feet/gi, "")
    .replace(/ft/gi, "")
    .trim();

  if (!normalized) return null;

  if (normalized.includes("+")) {
    const value = Number(normalized.replace(/\+/g, "").trim());
    return Number.isFinite(value) ? value : null;
  }

  const parts = normalized
    .replace(/[–—]/g, "-")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  const value = Number(parts[0]);
  return Number.isFinite(value) ? value : null;
}

function displayClarityFeetFromApiRow(row: ForecastApiResponse["hourly"][number], fallbackFeet: number) {
  if (typeof row.predictedClarityMinFt === "number") {
    return row.predictedClarityMinFt;
  }

  if (row.predictedClarityLabel) {
    const parsed = parseClarityFeetFromLabel(row.predictedClarityLabel);
    if (parsed !== null) {
      return parsed;
    }
  }

  return fallbackFeet;
}

function resolveSunTimesEntry(
  forecast: ForecastApiResponse | null,
  dayKey: string,
) {
  if (!forecast) return null;

  const exact = forecast.sunTimesByDay[dayKey];
  if (exact) {
    return exact;
  }

  for (const value of Object.values(forecast.sunTimesByDay)) {
    if (
      toLocalDayKey(value.sunriseIso) === dayKey ||
      toLocalDayKey(value.sunsetIso) === dayKey
    ) {
      return value;
    }
  }

  return null;
}

export function clarityLabelForFeet(value: number) {
  if (value >= 18) return "Excellent";
  if (value >= 13) return "Good";
  if (value >= 8) return "Fair";
  return "Poor";
}

export function buildForecastDays(start = new Date(), count = 10) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startOfToday = new Date(start);
  startOfToday.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startOfToday);
    date.setDate(startOfToday.getDate() + index);

    return {
      key: toLocalDayKey(date),
      label: formatter.format(date),
      date,
    } satisfies ForecastDay;
  });
}

export function buildCurrentConditions(spot: PinnedSpot): CurrentConditions {
  const seed = stableSeed(spot);
  const waveHeightFt = roundTo(1.8 + seededUnit(seed, 1) * 3.7, 1);
  const wavePeriodSec = roundTo(8 + seededUnit(seed, 2) * 8, 0);
  const tideHeightFt = roundTo(1.2 + seededUnit(seed, 3) * 4.3, 1);
  const windSpeedKt = roundTo(4 + seededUnit(seed, 4) * 13, 0);
  const waterTempF = roundTo(56 + seededUnit(seed, 5) * 11, 0);
  const clarityFt = roundTo(7 + seededUnit(seed, 6) * 15, 0);
  const clarityMin = Math.max(2, clarityFt - 2);
  const clarityMax = clarityFt + 2;
  const directionIndex = Math.floor(seededUnit(seed, 7) * 8);
  const windDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const tideDirection: CurrentConditions["tideDirection"] =
    seededUnit(seed, 8) > 0.66 ? "Rising" : seededUnit(seed, 8) > 0.33 ? "Falling" : "Slack";

  return {
    buoyLabel: `Using NOAA buoy ${spot.buoyId}`,
    waveHeightFt,
    wavePeriodSec,
    tideHeightFt,
    tideDirection,
    windDirection: windDirections[directionIndex] ?? "W",
    windSpeedKt,
    waterTempF,
    clarityFt,
    clarityRange: `${clarityMin}-${clarityMax} ft`,
    clarityLabel: clarityLabelForFeet(clarityFt),
  };
}

export function mapCurrentConditionsFromApi(
  spot: PinnedSpot,
  forecast: ForecastApiResponse | null,
): CurrentConditions {
  if (!forecast) {
    return buildCurrentConditions(spot);
  }

  return {
    buoyLabel: forecast.current.buoyLabel,
    waveHeightFt: forecast.current.waveHeightFt,
    wavePeriodSec: forecast.current.wavePeriodSec,
    tideHeightFt: forecast.current.tideHeightFt,
    tideDirection: forecast.current.tideDirection,
    windDirection: forecast.current.windDirectionCardinal,
    windSpeedKt: forecast.current.windSpeedKt,
    waterTempF: forecast.current.waterTempF,
    clarityFt: forecast.current.clarityFt,
    clarityRange: forecast.current.clarityRange,
    clarityLabel: forecast.current.clarityLabel,
  };
}

export function buildForecastRowForSlot(spot: PinnedSpot, slotTime: string) {
  const slotDate = new Date(slotTime);
  const day = new Date(slotDate);
  day.setHours(0, 0, 0, 0);

  return buildHourlyForecastRows(spot, day).find(
    (row) => new Date(row.timeIso).getTime() === slotDate.getTime(),
  );
}

export function getForecastClarityRangeForSlot(spot: PinnedSpot, slotTime: string) {
  const row = buildForecastRowForSlot(spot, slotTime);
  return row ? formatForecastClarityRange(row.clarityFt) : null;
}

export function getForecastClarityRangeForSlotFromApi(
  forecast: ForecastApiResponse | null,
  slotTime: string,
) {
  if (!forecast) return null;

  const target = new Date(slotTime).getTime();
  const row = forecast.hourly.find((point) => new Date(point.timeIso).getTime() === target);

  if (!row) return null;

  if (row.predictedClarityLabel) {
    return row.predictedClarityLabel;
  }

  if (typeof row.predictedClarityFt === "number") {
    return formatForecastClarityRange(row.predictedClarityFt);
  }

  return null;
}

export function buildHourlyForecastRows(
  spot: PinnedSpot,
  day: Date,
  selectedSlotTime?: string | null,
) {
  const seed = stableSeed(spot);
  const start = new Date(day);
  start.setHours(6, 0, 0, 0);
  const now = new Date();
  const isToday = toLocalDayKey(day) === toLocalDayKey(now);
  const rows: HourlyForecastRow[] = [];

  for (let hour = 6; hour <= 18; hour += 1) {
    const time = new Date(start);
    time.setHours(hour, 0, 0, 0);

    if (isToday && time.getTime() < now.getTime() - 60 * 60 * 1000) {
      continue;
    }

    const hourOffset = hour + day.getDate() * 0.5;
    const waveHeightFt = roundTo(1.5 + seededUnit(seed, hourOffset) * 4.1, 1);
    const wavePeriodSec = roundTo(7 + seededUnit(seed, hourOffset + 1) * 9, 0);
    const tideHeightFt = roundTo(0.7 + seededUnit(seed, hourOffset + 2) * 4.8, 1);
    const windSpeedKt = roundTo(3 + seededUnit(seed, hourOffset + 3) * 15, 0);
    const waterTempF = roundTo(56 + seededUnit(seed, hourOffset + 4) * 11, 0);
    const clarityFt = roundTo(6 + seededUnit(seed, hourOffset + 5) * 16, 0);
    const clarityLabel = clarityLabelForFeet(clarityFt);
    const tideTrend = seededUnit(seed, hourOffset + 6);
    const tideDirection: HourlyForecastRow["tideDirection"] =
      tideTrend > 0.66 ? "↗" : tideTrend > 0.33 ? "↘" : "→";
    const windDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const windDirection = windDirections[Math.floor(seededUnit(seed, hourOffset + 7) * 8)] ?? "W";
    const timeIso = time.toISOString();
    const selected = selectedSlotTime ? new Date(selectedSlotTime).getTime() === time.getTime() : false;

    rows.push({
      id: `${spot.id}-${timeIso}`,
      timeIso,
      hourLabel: new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
      }).format(time),
      waveText: `${waveHeightFt.toFixed(1)} ft @ ${wavePeriodSec.toFixed(0)}s`,
      tideText: `${tideHeightFt.toFixed(1)} ft`,
      tideDirection,
      clarityFt,
      clarityLabel,
      clarityText: selected ? `${clarityFt.toFixed(0)} ft • saved` : `${clarityFt.toFixed(0)} ft`,
      waterTempF,
      windText: `${windDirection} ${windSpeedKt.toFixed(0)} kt`,
    });
  }

  return rows;
}

function tideArrowFromTrend(value: number | null, previous: number | null, next: number | null) {
  if (value === null) return "→";

  let slope = 0;
  if (previous !== null && next !== null) {
    slope = next - previous;
  } else if (next !== null) {
    slope = next - value;
  } else if (previous !== null) {
    slope = value - previous;
  }

  if (slope > 0.05) return "↗";
  if (slope < -0.05) return "↘";
  return "→";
}

function formatHourLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

function formatWaveText(waveHeightFt: number | null, wavePeriodSec: number | null) {
  if (waveHeightFt === null && wavePeriodSec === null) return "—";
  if (waveHeightFt === null) return `— @ ${Math.round(wavePeriodSec ?? 0)}s`;
  if (wavePeriodSec === null) return `${waveHeightFt.toFixed(1)} ft`;
  return `${waveHeightFt.toFixed(1)} ft @ ${Math.round(wavePeriodSec)}s`;
}

function formatTideText(heightFt: number | null) {
  return heightFt === null ? "—" : `${heightFt.toFixed(1)} ft`;
}

function cardinalFromDegrees(degrees: number) {
  const directions = [
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
  return directions[index] ?? "N";
}

function filterDisplayWindow(
  forecast: ForecastApiResponse,
  dayKey: string,
  rows: ForecastApiResponse["hourly"],
) {
  const sun = resolveSunTimesEntry(forecast, dayKey);
  const now = new Date();
  const isToday = dayKey === toLocalDayKey(now);

  let startMs = Number.NEGATIVE_INFINITY;
  let endMs = Number.POSITIVE_INFINITY;

  if (sun) {
    startMs = new Date(sun.sunriseIso).getTime();
    endMs = new Date(sun.sunsetIso).getTime();
  } else {
    const dayStart = new Date(`${dayKey}T00:00:00`);
    const fallbackStart = new Date(dayStart);
    fallbackStart.setHours(6, 0, 0, 0);
    const fallbackEnd = new Date(dayStart);
    fallbackEnd.setHours(18, 0, 0, 0);
    startMs = fallbackStart.getTime();
    endMs = fallbackEnd.getTime();
  }

  if (isToday) {
    startMs = Math.max(startMs, now.getTime());
  }

  if (!(startMs < endMs)) {
    return [];
  }

  return rows.filter((row) => {
    const rowMs = new Date(row.timeIso).getTime();
    return rowMs >= startMs && rowMs <= endMs;
  });
}

export function buildHourlyForecastRowsFromApi(
  spot: PinnedSpot,
  forecast: ForecastApiResponse | null,
  day: Date,
  selectedSlotTime?: string | null,
) {
  if (!forecast) {
    return buildHourlyForecastRows(spot, day, selectedSlotTime);
  }

  const dayKey = toLocalDayKey(day);
  const rowsForDay = filterDisplayWindow(
    forecast,
    dayKey,
    forecast.hourly.filter((row) => toLocalDayKey(row.timeIso) === dayKey),
  );

  return rowsForDay.map((row, index, array) => {
    const time = new Date(row.timeIso);
    const previousTide = index > 0 ? array[index - 1]?.tideHeightFt ?? null : null;
    const nextTide = index + 1 < array.length ? array[index + 1]?.tideHeightFt ?? null : null;
    const rawClarityFt = row.predictedClarityFt ?? forecast.current.clarityFt;
    const clarityFt = displayClarityFeetFromApiRow(row, rawClarityFt);
    const clarityLabel = row.predictedClarityLabel ?? formatForecastClarityRange(rawClarityFt);
    const selected = selectedSlotTime
      ? new Date(selectedSlotTime).getTime() === time.getTime()
      : false;

    return {
      id: `${spot.id}-${row.timeIso}`,
      timeIso: row.timeIso,
      hourLabel: formatHourLabel(time),
      waveText: formatWaveText(row.waveHeightFt, row.wavePeriodSec),
      tideText: formatTideText(row.tideHeightFt),
      tideDirection: tideArrowFromTrend(row.tideHeightFt, previousTide, nextTide),
      clarityFt,
      clarityLabel,
      clarityText: selected ? `${clarityLabel} • saved` : clarityLabel,
      waterTempF: row.waterTempF,
      windText:
        row.windDirectionDeg === null && row.windSpeedKt === null
          ? "—"
          : `${row.windDirectionDeg === null ? "—" : cardinalFromDegrees(row.windDirectionDeg)}${
              row.windSpeedKt === null ? "" : ` ${Math.round(row.windSpeedKt)} kt`
            }`,
    } satisfies HourlyForecastRow;
  });
}

export function resolveSunTimesForDay(forecast: ForecastApiResponse | null, dayKey: string) {
  return resolveSunTimesEntry(forecast, dayKey);
}
