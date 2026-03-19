import { useMemo, useState } from "react";
import type { PinnedSpot, PlannedDive } from "../../domain/types";
import {
  buildCurrentConditions,
  buildForecastDays,
  buildHourlyForecastRows,
} from "./placeholderForecast";

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

function formatCurrentDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

type ForecastDetailScreenProps = {
  spot: PinnedSpot;
  initialSlotTime?: string | null;
  isFavorite: boolean;
  plannedDives: PlannedDive[];
  onBack: () => void;
  onToggleFavorite: () => void;
  onPlanDive: (slotTime: string) => void;
};

export function ForecastDetailScreen({
  spot,
  initialSlotTime,
  isFavorite,
  plannedDives,
  onBack,
  onToggleFavorite,
  onPlanDive,
}: ForecastDetailScreenProps) {
  const days = useMemo(() => buildForecastDays(new Date(), 10), []);
  const initialDayIndex = useMemo(() => {
    if (!initialSlotTime) return 0;

    const targetKey = new Date(initialSlotTime).toISOString().slice(0, 10);
    const foundIndex = days.findIndex((day) => day.key === targetKey);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [days, initialSlotTime]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(initialDayIndex);

  const selectedDay = days[selectedDayIndex] ?? days[0];
  const conditions = useMemo(() => buildCurrentConditions(spot), [spot]);
  const rows = useMemo(
    () => buildHourlyForecastRows(spot, selectedDay.date, initialSlotTime),
    [spot, selectedDay, initialSlotTime],
  );

  const plannedTimes = useMemo(
    () =>
      new Set(
        plannedDives
          .filter((dive) => dive.spotId === spot.id)
          .map((dive) => new Date(dive.slotTime).getTime()),
      ),
    [plannedDives, spot.id],
  );

  return (
    <section className="forecast-detail-shell">
      <div className="forecast-detail-scroll">
        <header className="forecast-detail-hero">
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
              <h1>{spot.name}</h1>
              <p>{formatCurrentDate(new Date())}</p>
            </div>

            <button
              type="button"
              className={isFavorite ? "detail-circle-button active" : "detail-circle-button"}
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
            >
              <StarIcon active={isFavorite} />
            </button>
          </div>
        </header>

        <div className="forecast-detail-content">
          <section className="forecast-section-card">
            <div className="forecast-section-heading">
              <div>
                <h2>Current Conditions</h2>
                <p>{conditions.buoyLabel}</p>
              </div>
              <div className="forecast-clarity-pill">
                <span>{conditions.clarityLabel}</span>
                <strong>{conditions.clarityRange}</strong>
              </div>
            </div>

            <div className="forecast-current-grid">
              <div>
                <span>Wave</span>
                <strong>{conditions.waveHeightFt.toFixed(1)} ft @ {conditions.wavePeriodSec.toFixed(0)}s</strong>
              </div>
              <div>
                <span>Tide</span>
                <strong>{conditions.tideDirection} {conditions.tideHeightFt.toFixed(1)} ft</strong>
              </div>
              <div>
                <span>Wind</span>
                <strong>{conditions.windDirection} {conditions.windSpeedKt.toFixed(0)} kt</strong>
              </div>
              <div>
                <span>Water</span>
                <strong>{conditions.waterTempF.toFixed(0)}°F</strong>
              </div>
            </div>
          </section>

          <section className="forecast-section-card">
            <div className="forecast-section-heading compact">
              <div>
                <h2>Forecast</h2>
                <p>Placeholder values mapped to this location for UI work.</p>
              </div>
            </div>

            <div className="forecast-day-strip" role="tablist" aria-label="Forecast days">
              {days.map((day, index) => (
                <button
                  key={day.key}
                  type="button"
                  className={
                    index === selectedDayIndex ? "forecast-day-pill active" : "forecast-day-pill"
                  }
                  onClick={() => setSelectedDayIndex(index)}
                  role="tab"
                  aria-selected={index === selectedDayIndex}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="forecast-hourly-table-wrap">
              <div className="forecast-hourly-header">
                <span>Time</span>
                <span>Wave</span>
                <span>Tide</span>
                <span>Clarity</span>
                <span>Plan</span>
              </div>

              <div className="forecast-hourly-rows">
                {rows.map((row) => {
                  const isPlanned = plannedTimes.has(new Date(row.timeIso).getTime());
                  const isInitial = initialSlotTime
                    ? new Date(initialSlotTime).getTime() === new Date(row.timeIso).getTime()
                    : false;

                  return (
                    <div
                      key={row.id}
                      className={isInitial ? "forecast-hourly-row active" : "forecast-hourly-row"}
                    >
                      <span>{row.hourLabel}</span>
                      <span>{row.waveText}</span>
                      <span>
                        {row.tideText} <em>{row.tideDirection}</em>
                      </span>
                      <span className="forecast-row-clarity">
                        <strong>{row.clarityText}</strong>
                        <small>{row.clarityLabel}</small>
                      </span>
                      <span>
                        <button
                          type="button"
                          className={isPlanned ? "table-plan-button active" : "table-plan-button"}
                          onClick={() => onPlanDive(row.timeIso)}
                          disabled={isPlanned}
                        >
                          {isPlanned ? "Saved" : "Plan"}
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
    </section>
  );
}
