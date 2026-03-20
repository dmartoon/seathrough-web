import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import type { PinnedSpot, PlannedDive } from "../../domain/types";
import {
  buildForecastDays,
  buildHourlyForecastRowsFromApi,
  mapCurrentConditionsFromApi,
  resolveSunTimesForDay,
  toLocalDayKey,
} from "./placeholderForecast";
import { useSpotForecast } from "./useSpotForecast";

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="detail-top-icon">
      <path
        d="M14.5 5.5 8 12l6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="detail-top-icon">
      <path
        d="M12 3.2l2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 17.5l-5.6 2.94 1.07-6.24L2.94 9.78l6.26-.91L12 3.2Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="detail-pencil-icon">
      <path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z"
        fill="currentColor"
      />
      <path
        d="M14.06 6.19 16.5 3.75a1.5 1.5 0 0 1 2.12 0l1.63 1.63a1.5 1.5 0 0 1 0 2.12l-2.44 2.44-3.75-3.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="forecast-metric-icon-svg">
      <path
        d="M3 10.5c1.5 0 1.5-2 3-2s1.5 2 3 2 1.5-2 3-2 1.5 2 3 2 1.5-2 3-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 15.5c1.5 0 1.5-2 3-2s1.5 2 3 2 1.5-2 3-2 1.5 2 3 2 1.5-2 3-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TideIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="forecast-metric-icon-svg">
      <path
        d="M12 4v16M8.7 7.3 12 4l3.3 3.3M8.7 16.7 12 20l3.3-3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="forecast-metric-icon-svg">
      <path
        d="M4 9.5h10.5a2.5 2.5 0 1 0-2.5-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14h13.5a2.5 2.5 0 1 1-2.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="forecast-metric-icon-svg">
      <path
        d="M12 3.5c-2.5 3.3-4.8 6-4.8 9A4.8 4.8 0 0 0 12 17.3a4.8 4.8 0 0 0 4.8-4.8c0-3-2.3-5.7-4.8-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 12.6c0 1.2 1 2.2 2.2 2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}


type ForecastDetailScreenProps = {
  spot: PinnedSpot;
  initialSlotTime?: string | null;
  isFavorite: boolean;
  plannedDives: PlannedDive[];
  onBack: () => void;
  onToggleFavorite: () => void;
  onRename: (nextName: string) => void;
  onTogglePlanDive: (slotTime: string) => void;
};

type MetricItem = {
  icon: "wave" | "tide" | "wind" | "water";
  label: string;
  value: string;
};

const WEEKDAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const MONTH_DAY = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const TIME_ONLY = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

function toDayKey(value: Date | string) {
  return toLocalDayKey(value);
}

function getDayPrimaryLabel(date: Date, index: number) {
  return index === 0 ? "Today" : WEEKDAY_SHORT.format(date);
}

function cardinalToDegrees(direction: string) {
  const normalized = direction.trim().toUpperCase();
  const mapping: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };

  return mapping[normalized] ?? null;
}

function angularDifference(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function windRelationToShore(direction: string | null, shoreDirection: number) {
  if (!direction) {
    return null;
  }

  const windDegrees = cardinalToDegrees(direction);

  if (windDegrees === null) {
    return "Cross-shore";
  }

  const diff = angularDifference(windDegrees, shoreDirection);

  if (diff <= 45) return "Onshore";
  if (diff >= 135) return "Offshore";
  return "Cross-shore";
}

function formatCurrentWaveValue(waveHeightFt: number | null, wavePeriodSec: number | null) {
  if (waveHeightFt === null && wavePeriodSec === null) return "—";
  if (waveHeightFt === null) return `— @ ${Math.round(wavePeriodSec ?? 0)}s`;
  if (wavePeriodSec === null) return `${waveHeightFt.toFixed(1)} ft`;
  return `${waveHeightFt.toFixed(1)} ft @ ${wavePeriodSec.toFixed(0)}s`;
}

function formatCurrentTideValue(
  tideDirection: "Rising" | "Falling" | "Slack" | "Steady" | null,
  tideHeightFt: number | null,
) {
  if (!tideDirection && tideHeightFt === null) return "—";
  if (!tideDirection) return tideHeightFt === null ? "—" : `${tideHeightFt.toFixed(1)} ft`;
  if (tideHeightFt === null) return `${tideDirection} —`;
  return `${tideDirection} ${tideHeightFt.toFixed(1)} ft`;
}

function formatCurrentWindValue(
  windDirection: string | null,
  windSpeedKt: number | null,
  shoreDirection: number,
) {
  const relation = windRelationToShore(windDirection, shoreDirection);

  if (!windDirection && windSpeedKt === null) return "—";
  if (!windDirection) return `${Math.round(windSpeedKt ?? 0)} kt`;
  if (windSpeedKt === null) return relation ? `${windDirection} • ${relation}` : windDirection;
  return relation
    ? `${windDirection} ${windSpeedKt.toFixed(0)} kt • ${relation}`
    : `${windDirection} ${windSpeedKt.toFixed(0)} kt`;
}

function clarityChipStyle(ft: number | null) {
  if (ft === null || !Number.isFinite(ft)) {
    return {
      color: "rgba(244, 248, 252, 0.92)",
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      borderColor: "rgba(255, 255, 255, 0.22)",
      boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
    };
  }

  if (ft >= 20) {
    return {
      color: "#f2ffef",
      backgroundColor: "rgba(37, 112, 69, 0.52)",
      borderColor: "rgba(123, 237, 168, 0.72)",
      boxShadow: "inset 0 0 0 1px rgba(197, 255, 220, 0.08)",
    };
  }

  if (ft >= 15) {
    return {
      color: "#fff8dc",
      backgroundColor: "rgba(104, 102, 28, 0.58)",
      borderColor: "rgba(224, 216, 95, 0.78)",
      boxShadow: "inset 0 0 0 1px rgba(255, 244, 177, 0.08)",
    };
  }

  if (ft >= 10) {
    return {
      color: "#fff1d6",
      backgroundColor: "rgba(129, 79, 15, 0.6)",
      borderColor: "rgba(255, 189, 82, 0.8)",
      boxShadow: "inset 0 0 0 1px rgba(255, 219, 157, 0.08)",
    };
  }

  return {
    color: "#ffe2d4",
    backgroundColor: "rgba(127, 50, 21, 0.62)",
    borderColor: "rgba(255, 144, 89, 0.8)",
    boxShadow: "inset 0 0 0 1px rgba(255, 204, 183, 0.08)",
  };
}

function metricIconFor(type: MetricItem["icon"]): ReactNode {
  switch (type) {
    case "wave":
      return <WaveIcon />;
    case "tide":
      return <TideIcon />;
    case "wind":
      return <WindIcon />;
    case "water":
      return <WaterIcon />;
    default:
      return null;
  }
}

function ForecastMetricRow({ item }: { item: MetricItem }) {
  return (
    <div className="forecast-metric-row">
      <span className="forecast-metric-icon">{metricIconFor(item.icon)}</span>
      <span className="forecast-metric-text">
        {item.label} <strong>{item.value}</strong>
      </span>
    </div>
  );
}

function ForecastSummaryCard({
  title,
  subtitle,
  metrics,
  clarityLabel,
  clarityValue,
  action,
}: {
  title: string;
  subtitle: string;
  metrics: MetricItem[];
  clarityLabel: string;
  clarityValue: string;
  action?: ReactNode;
}) {
  return (
    <section className="forecast-summary-block">
      <div className="forecast-summary-heading">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="forecast-summary-card">
        <div className="forecast-summary-body">
          <div className="forecast-summary-metrics">
            {metrics.map((item) => (
              <ForecastMetricRow key={`${item.icon}-${item.label}-${item.value}`} item={item} />
            ))}
          </div>

          <div className="forecast-summary-side">
            <div className="forecast-summary-clarity-label">
              <span>{clarityLabel}</span>
            </div>
            <strong>{clarityValue}</strong>
          </div>
        </div>

        {action ? <div className="forecast-summary-actions">{action}</div> : null}
      </div>
    </section>
  );
}

function ClarityChip({ text, feet }: { text: string; feet: number | null }) {
  return (
    <span className="forecast-clarity-chip" style={clarityChipStyle(feet)}>{text}</span>
  );
}

export function ForecastDetailScreen({
  spot,
  initialSlotTime,
  isFavorite,
  plannedDives,
  onBack,
  onToggleFavorite,
  onRename,
  onTogglePlanDive,
}: ForecastDetailScreenProps) {
  const days = useMemo(() => buildForecastDays(new Date(), 10), []);
  const initialDayIndex = useMemo(() => {
    if (!initialSlotTime) return 0;

    const targetKey = toDayKey(initialSlotTime);
    const foundIndex = days.findIndex((day) => day.key === targetKey);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [days, initialSlotTime]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(initialDayIndex);
  const [titleDraft, setTitleDraft] = useState(spot.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDay = days[selectedDayIndex] ?? days[0];
  const { data: forecastData } = useSpotForecast(spot);
  const currentConditions = useMemo(
    () => mapCurrentConditionsFromApi(spot, forecastData),
    [spot, forecastData],
  );
  const rows = useMemo(
    () => buildHourlyForecastRowsFromApi(spot, forecastData, selectedDay.date, initialSlotTime),
    [spot, forecastData, selectedDay, initialSlotTime],
  );

  useEffect(() => {
    setTitleDraft(spot.name);
    setIsRenaming(false);
  }, [spot.name]);

  useEffect(() => {
    if (!isRenaming) return;

    const frame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isRenaming]);


  const plannedTimes = useMemo(
    () =>
      new Set(
        plannedDives
          .filter((dive) => dive.spotId === spot.id)
          .map((dive) => new Date(dive.slotTime).getTime()),
      ),
    [plannedDives, spot.id],
  );


  const sunTimes = useMemo(() => {
    const resolved = resolveSunTimesForDay(forecastData, selectedDay.key);

    if (!resolved) {
      return {
        sunriseLabel: "—",
        sunsetLabel: "—",
      };
    }

    return {
      sunriseLabel: TIME_ONLY.format(new Date(resolved.sunriseIso)),
      sunsetLabel: TIME_ONLY.format(new Date(resolved.sunsetIso)),
    };
  }, [forecastData, selectedDay.key]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    const nextName = trimmed || "Pinned Spot";

    if (nextName !== spot.name) {
      onRename(nextName);
    }

    setTitleDraft(nextName);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setTitleDraft(spot.name);
    setIsRenaming(false);
  };

  return (
    <section className="forecast-detail-shell">
      <div className="forecast-detail-scroll">
        <div className="forecast-detail-hero-band">
          <div className="forecast-detail-hero-inner">
            <div className="forecast-detail-topbar">
              <button
                type="button"
                className="detail-circle-button"
                onClick={onBack}
                aria-label="Back"
              >
                <BackIcon />
              </button>

              <div className="forecast-detail-title-wrap">
                <h1
                  className={
                    isRenaming
                      ? "forecast-detail-title is-hidden"
                      : "forecast-detail-title"
                  }
                >
                  {spot.name}
                </h1>
                <input
                  ref={titleInputRef}
                  className={
                    isRenaming
                      ? "forecast-detail-title-input is-visible"
                      : "forecast-detail-title-input"
                  }
                  type="text"
                  value={titleDraft}
                  onClick={stopPropagation}
                  onPointerDown={stopPropagation}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setTitleDraft(event.target.value)
                  }
                  onBlur={commitTitle}
                  onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === "Enter") {
                      commitTitle();
                      event.currentTarget.blur();
                    }

                    if (event.key === "Escape") {
                      cancelRename();
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label="Location name"
                  placeholder="Pinned Spot"
                  tabIndex={isRenaming ? 0 : -1}
                />
              </div>

              <div className="forecast-detail-topbar-actions">
                <button
                  type="button"
                  className={
                    isRenaming
                      ? "detail-circle-button detail-rename-button active"
                      : "detail-circle-button detail-rename-button"
                  }
                  onClick={(event) => {
                    stopPropagation(event);

                    if (isRenaming) {
                      commitTitle();
                      return;
                    }

                    setIsRenaming(true);
                  }}
                  aria-label="Rename location"
                  title="Rename location"
                >
                  <PencilIcon />
                </button>

                <button
                  type="button"
                  className={
                    isFavorite
                      ? "detail-circle-button active"
                      : "detail-circle-button"
                  }
                  onClick={onToggleFavorite}
                  aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
                  title={isFavorite ? "Remove favorite" : "Add favorite"}
                >
                  <StarIcon active={isFavorite} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="forecast-detail-stage">
          <div className="forecast-detail-content forecast-detail-stack">
            <ForecastSummaryCard
              title="Current Conditions"
              subtitle={currentConditions.buoyLabel}
              metrics={[
                {
                  icon: "wave",
                  label: "Wave:",
                  value: formatCurrentWaveValue(
                    currentConditions.waveHeightFt,
                    currentConditions.wavePeriodSec,
                  ),
                },
                {
                  icon: "tide",
                  label: "Tide:",
                  value: formatCurrentTideValue(
                    currentConditions.tideDirection,
                    currentConditions.tideHeightFt,
                  ),
                },
                {
                  icon: "wind",
                  label: "Wind:",
                  value: formatCurrentWindValue(
                    currentConditions.windDirection,
                    currentConditions.windSpeedKt,
                    spot.shoreDirection,
                  ),
                },
                {
                  icon: "water",
                  label: "Water:",
                  value:
                    currentConditions.waterTempF === null
                      ? `—`
                      : `${currentConditions.waterTempF.toFixed(0)}°F`,
                },
              ]}
              clarityLabel="Water Clarity"
              clarityValue={currentConditions.clarityRange}
            />

            <section className="forecast-table-section">
              <div
                className="forecast-detail-day-strip"
                role="tablist"
                aria-label="Forecast days"
              >
                {days.map((day, index) => (
                  <button
                    key={day.key}
                    type="button"
                    className={
                      index === selectedDayIndex
                        ? "forecast-day-tile active"
                        : "forecast-day-tile"
                    }
                    onClick={() => setSelectedDayIndex(index)}
                    role="tab"
                    aria-selected={index === selectedDayIndex}
                  >
                    <span className="forecast-day-tile-top">
                      {getDayPrimaryLabel(day.date, index)}
                    </span>
                    <span className="forecast-day-tile-bottom">
                      {MONTH_DAY.format(day.date)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="forecast-sun-row">
                <span>Sunrise {sunTimes.sunriseLabel}</span>
                <span>Sunset {sunTimes.sunsetLabel}</span>
              </div>

              <div className="forecast-table-shell">
                <div className="forecast-table-header">
                  <span>Time</span>
                  <span>Wave</span>
                  <span>Tide</span>
                  <span>Clarity</span>
                  <span className="forecast-table-action-header">Plan</span>
                </div>

                <div className="forecast-table-rows">
                  {rows.map((row) => {
                    const rowTime = new Date(row.timeIso).getTime();
                    const isSelected = initialSlotTime
                      ? rowTime === new Date(initialSlotTime).getTime()
                      : false;
                    const isSaved = plannedTimes.has(rowTime);

                    return (
                      <div
                        key={row.id}
                        className={
                          isSelected
                            ? "forecast-table-row is-selected"
                            : "forecast-table-row"
                        }
                      >
                        <span className="forecast-table-time-cell">
                          <strong>{row.hourLabel}</strong>
                        </span>
                        <span>{row.waveText}</span>
                        <span>
                          {row.tideText} <em>{row.tideDirection}</em>
                        </span>
                        <span className="forecast-table-clarity-cell">
                          <ClarityChip
                            text={row.clarityLabel}
                            feet={row.clarityFt}
                          />
                        </span>
                        <span className="forecast-table-action-cell">
                          <button
                            type="button"
                            className={
                              isSaved
                                ? "table-plan-button compact-button active"
                                : "table-plan-button compact-button"
                            }
                            onClick={() => onTogglePlanDive(row.timeIso)}
                            aria-label={isSaved ? `Remove planned dive at ${row.hourLabel}` : `Add ${row.hourLabel} to planned dives`}
                          >
                            <span className="table-plan-button-icon" aria-hidden="true">
                              {isSaved ? "✓" : "+"}
                            </span>
                            <span className="table-plan-button-label">{isSaved ? "Planned" : "Add"}</span>
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
