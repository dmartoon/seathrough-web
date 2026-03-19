import type { PinnedSpot } from "../../domain/types";

export type CurrentConditions = {
  buoyLabel: string;
  waveHeightFt: number;
  wavePeriodSec: number;
  tideHeightFt: number;
  tideDirection: "Rising" | "Falling" | "Slack";
  windDirection: string;
  windSpeedKt: number;
  waterTempF: number;
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
  waterTempF: number;
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
      key: date.toISOString().slice(0, 10),
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

export function buildHourlyForecastRows(
  spot: PinnedSpot,
  day: Date,
  selectedSlotTime?: string | null,
) {
  const seed = stableSeed(spot);
  const start = new Date(day);
  start.setHours(6, 0, 0, 0);
  const now = new Date();
  const isToday = day.toDateString() === now.toDateString();
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
