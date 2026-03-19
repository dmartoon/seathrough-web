import { useEffect, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import type { PinnedSpot } from "../../domain/types";
import { buildCurrentConditions } from "../../features/forecast/placeholderForecast";

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="spot-card-star-icon">
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="map-spot-card-pencil-icon">
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

type MapSpotCardProps = {
  spot: PinnedSpot;
  isFavorite: boolean;
  onOpenDetail: () => void;
  onToggleFavorite: () => void;
  onRename: (nextName: string) => void;
};

export function MapSpotCard({
  spot,
  isFavorite,
  onOpenDetail,
  onToggleFavorite,
  onRename,
}: MapSpotCardProps) {
  const conditions = buildCurrentConditions(spot);
  const [titleDraft, setTitleDraft] = useState(spot.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitleDraft(spot.name);
    setIsRenaming(false);
  }, [spot.name]);

  const stop = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  useEffect(() => {
    if (!isRenaming) return;

    const frame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isRenaming]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    const nextName = trimmed || "Dropped pin";

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
    <div className="map-spot-card">
      <div className="map-spot-card-header">
        <div className="map-spot-card-main">
          <div className="map-spot-card-title-row">
            <div className="map-spot-card-title-field">
              <h3 className={isRenaming ? "map-spot-card-title is-hidden" : "map-spot-card-title"}>
                {spot.name}
              </h3>
              <input
                ref={titleInputRef}
                className={
                  isRenaming
                    ? "map-spot-card-title-input is-visible"
                    : "map-spot-card-title-input"
                }
                type="text"
                value={titleDraft}
                onClick={stop}
                onPointerDown={stop}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTitleDraft(event.target.value)}
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
                aria-label="Pin title"
                placeholder="Dropped pin"
                tabIndex={isRenaming ? 0 : -1}
              />
            </div>

            <button
              type="button"
              className={
                isRenaming
                  ? "spot-card-icon-button map-spot-card-rename-button is-hidden"
                  : "spot-card-icon-button map-spot-card-rename-button"
              }
              onClick={(event) => {
                stop(event);
                setIsRenaming(true);
              }}
              aria-label="Rename pin"
              title="Rename pin"
              tabIndex={isRenaming ? -1 : 0}
            >
              <PencilIcon />
            </button>
          </div>

          <p className="map-spot-card-subtitle">Current conditions</p>
          <span className="map-spot-card-source">Using NOAA buoy 46222</span>

          <div className="map-spot-card-rows">
            <p>
              Wave: <strong>{conditions.waveHeightFt.toFixed(1)} ft @ {conditions.wavePeriodSec.toFixed(0)}s</strong>
            </p>
            <p>
              Tide: <strong>{conditions.tideDirection} {conditions.tideHeightFt.toFixed(1)} ft</strong>
            </p>
            <p>
              Wind: <strong>{conditions.windDirection} {conditions.windSpeedKt.toFixed(0)} kt</strong>
            </p>
            <p>
              Water: <strong>{conditions.waterTempF.toFixed(0)}°F</strong>
            </p>
          </div>
        </div>

        <div className="map-spot-card-side-column">
          <button
            type="button"
            className={isFavorite ? "spot-card-icon-button active" : "spot-card-icon-button"}
            onClick={(event) => {
              stop(event);
              onToggleFavorite();
            }}
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
            title={isFavorite ? "Remove favorite" : "Add favorite"}
          >
            <StarIcon active={isFavorite} />
          </button>

          <div className="map-spot-card-clarity">
            <span>Water Clarity</span>
            <strong>{conditions.clarityRange}</strong>
          </div>

          <button
            type="button"
            className="primary-button compact-button map-spot-card-forecast-button"
            onClick={(event) => {
              stop(event);
              onOpenDetail();
            }}
          >
            View forecast
          </button>
        </div>
      </div>
    </div>
  );
}
