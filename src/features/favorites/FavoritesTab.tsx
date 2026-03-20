import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from "react";
import type { PinnedSpot } from "../../domain/types";
import { mapCurrentConditionsFromApi } from "../forecast/placeholderForecast";
import { useSpotForecast } from "../forecast/useSpotForecast";

type FavoritesTabProps = {
  favorites: PinnedSpot[];
  onOpen: (spot: PinnedSpot) => void;
  onRemove: (spot: PinnedSpot) => void;
  onRename: (spot: PinnedSpot, nextName: string) => void;
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="list-spot-pencil-icon">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor" />
      <path
        d="M14.06 6.19 16.5 3.75a1.5 1.5 0 0 1 2.12 0l1.63 1.63a1.5 1.5 0 0 1 0 2.12l-2.44 2.44-3.75-3.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FavoriteSpotCard({
  spot,
  onOpen,
  onRemove,
  onRename,
}: {
  spot: PinnedSpot;
  onOpen: (spot: PinnedSpot) => void;
  onRemove: (spot: PinnedSpot) => void;
  onRename: (spot: PinnedSpot, nextName: string) => void;
}) {
  const { data: forecastData } = useSpotForecast(spot);
  const conditions = mapCurrentConditionsFromApi(spot, forecastData);
  const [titleDraft, setTitleDraft] = useState(spot.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitleDraft(spot.name);
    setIsRenaming(false);
  }, [spot.name]);

  useEffect(() => {
    if (!isRenaming) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isRenaming]);

  const stop = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const openSpot = () => {
    onOpen(spot);
  };

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    const nextName = trimmed || "Pinned Spot";

    if (nextName !== spot.name) {
      onRename(spot, nextName);
    }

    setTitleDraft(nextName);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setTitleDraft(spot.name);
    setIsRenaming(false);
  };

  const handleMainKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isRenaming) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSpot();
    }
  };

  return (
    <article className="list-spot-card">
      <div
        className="list-spot-main"
        role="button"
        tabIndex={0}
        onClick={openSpot}
        onKeyDown={handleMainKeyDown}
      >
        <div className="list-spot-copy">
          <div className="list-spot-title-row">
            <div className="list-spot-title-field">
              <h3 className={isRenaming ? "list-spot-title is-hidden" : "list-spot-title"}>
                {spot.name}
              </h3>
              <input
                ref={inputRef}
                className={isRenaming ? "list-spot-title-input is-visible" : "list-spot-title-input"}
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
                aria-label="Favorite name"
                placeholder="Pinned Spot"
                tabIndex={isRenaming ? 0 : -1}
              />
            </div>

            <button
              type="button"
              className={
                isRenaming
                  ? "spot-card-icon-button list-spot-rename-button is-hidden"
                  : "spot-card-icon-button list-spot-rename-button"
              }
              onClick={(event) => {
                stop(event);
                setIsRenaming(true);
              }}
              aria-label="Rename favorite"
              title="Rename favorite"
              tabIndex={isRenaming ? -1 : 0}
            >
              <PencilIcon />
            </button>
          </div>

          <p className="list-spot-buoy">{conditions.buoyLabel}</p>
        </div>

        <div className="list-spot-side">
          <span className="list-spot-side-label">Current water clarity</span>
          <strong>{conditions.clarityRange}</strong>
        </div>
      </div>

      <div className="list-spot-actions">
        <button type="button" className="secondary-button compact-button" onClick={() => onOpen(spot)}>
          View forecast
        </button>
        <button
          type="button"
          className="ghost-button compact-button"
          onClick={() => onRemove(spot)}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

export function FavoritesTab({ favorites, onOpen, onRemove, onRename }: FavoritesTabProps) {
  if (favorites.length === 0) {
    return (
      <section className="list-stage">
        <div className="section-empty-card">
          <h2>Favorites</h2>
          <p className="helper-text">
            Drop a pin on the map and tap the star on the popup to save it here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="list-stage">
      <div className="section-title-row">
        <div>
          <h2>Favorites</h2>
        </div>
      </div>

      <div className="spot-list">
        {favorites.map((spot) => (
          <FavoriteSpotCard
            key={spot.id}
            spot={spot}
            onOpen={onOpen}
            onRemove={onRemove}
            onRename={onRename}
          />
        ))}
      </div>
    </section>
  );
}
