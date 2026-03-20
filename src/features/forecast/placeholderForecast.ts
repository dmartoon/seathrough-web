import type { PinnedSpot } from "../../domain/types";
import type { ForecastApiResponse } from "./forecastApi";

export type CurrentConditions = {
  buoyLabel: string;
  waveHeightFt: number | null;
  wavePeriodSec: number | null;
  tideHeightFt: number | null;
  tideDirection: "Rising" | "Falling" | "Slack" | "Steady" | null;
  windDirection: string | null;
  windSpeedKt: number | null;
  waterTempF: number | null;
  clarityFt: number | null;
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
  clarityFt: number | null;
  clarityLabel: string;
  clarityText: string;
  waterTempF: number | null;
  windText: string;
};

const UNAVAILABLE_TEXT = "—";

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

function displayClarityFeetFromApiRow(row: ForecastApiResponse["hourly"][number]) {
  if (typeof row.predictedClarityMinFt === "number") {
    return row.predictedClarityMinFt;
  }

  if (row.predictedClarityLabel) {
    const parsed = parseClarityFeetFromLabel(row.predictedClarityLabel);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (typeof row.predictedClarityFt === "number") {
    return row.predictedClarityFt;
  }

  return null;
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
  return {
    buoyLabel: `Using NOAA buoy ${spot.buoyId}`,
    waveHeightFt: null,
    wavePeriodSec: null,
    tideHeightFt: null,
    tideDirection: null,
    windDirection: null,
    windSpeedKt: null,
    waterTempF: null,
    clarityFt: null,
    clarityRange: UNAVAILABLE_TEXT,
    clarityLabel: UNAVAILABLE_TEXT,
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
    buoyLabel: forecast.current.buoyLabel || `Using NOAA buoy ${spot.buoyId}`,
    waveHeightFt:
      typeof forecast.current.waveHeightFt === "number" ? forecast.current.waveHeightFt : null,
    wavePeriodSec:
      typeof forecast.current.wavePeriodSec === "number" ? forecast.current.wavePeriodSec : null,
    tideHeightFt: forecast.current.tideHeightFt,
    tideDirection: forecast.current.tideDirection ?? null,
    windDirection: forecast.current.windDirectionCardinal || null,
    windSpeedKt:
      typeof forecast.current.windSpeedKt === "number" ? forecast.current.windSpeedKt : null,
    waterTempF: forecast.current.waterTempF,
    clarityFt:
      typeof forecast.current.clarityFt === "number" ? forecast.current.clarityFt : null,
    clarityRange: forecast.current.clarityRange || UNAVAILABLE_TEXT,
    clarityLabel: forecast.current.clarityLabel || UNAVAILABLE_TEXT,
  };
}

export function buildForecastRowForSlot(_spot: PinnedSpot, _slotTime: string) {
  return undefined;
}

export function getForecastClarityRangeForSlot(_spot: PinnedSpot, _slotTime: string) {
  return null;
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
  _spot: PinnedSpot,
  _day: Date,
  __selectedSlotTime?: string | null,
) {
  return [] satisfies HourlyForecastRow[];
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
  if (waveHeightFt === null && wavePeriodSec === null) return UNAVAILABLE_TEXT;
  if (waveHeightFt === null) return `— @ ${Math.round(wavePeriodSec ?? 0)}s`;
  if (wavePeriodSec === null) return `${waveHeightFt.toFixed(1)} ft`;
  return `${waveHeightFt.toFixed(1)} ft @ ${Math.round(wavePeriodSec)}s`;
}

function formatTideText(heightFt: number | null) {
  return heightFt === null ? UNAVAILABLE_TEXT : `${heightFt.toFixed(1)} ft`;
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
    const clarityFt = displayClarityFeetFromApiRow(row);
    const clarityLabel = row.predictedClarityLabel ??
      (typeof row.predictedClarityFt === "number"
        ? formatForecastClarityRange(row.predictedClarityFt)
        : UNAVAILABLE_TEXT);

    return {
      id: `${spot.id}-${row.timeIso}`,
      timeIso: row.timeIso,
      hourLabel: formatHourLabel(time),
      waveText: formatWaveText(row.waveHeightFt, row.wavePeriodSec),
      tideText: formatTideText(row.tideHeightFt),
      tideDirection: tideArrowFromTrend(row.tideHeightFt, previousTide, nextTide),
      clarityFt,
      clarityLabel,
      clarityText: clarityLabel,
      waterTempF: row.waterTempF,
      windText:
        row.windDirectionDeg === null && row.windSpeedKt === null
          ? UNAVAILABLE_TEXT
          : `${row.windDirectionDeg === null ? "—" : cardinalFromDegrees(row.windDirectionDeg)}${
              row.windSpeedKt === null ? "" : ` ${Math.round(row.windSpeedKt)} kt`
            }`,
    } satisfies HourlyForecastRow;
  });
}

export function resolveSunTimesForDay(forecast: ForecastApiResponse | null, dayKey: string) {
  return resolveSunTimesEntry(forecast, dayKey);
}
