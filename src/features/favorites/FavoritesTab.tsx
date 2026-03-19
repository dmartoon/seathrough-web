import type { PinnedSpot } from "../../domain/types";
import { buildCurrentConditions } from "../forecast/placeholderForecast";
import { formatLatLng } from "../../domain/spotHelpers";

type FavoritesTabProps = {
  favorites: PinnedSpot[];
  onOpen: (spot: PinnedSpot) => void;
  onRemove: (spot: PinnedSpot) => void;
};

export function FavoritesTab({ favorites, onOpen, onRemove }: FavoritesTabProps) {
  if (favorites.length === 0) {
    return (
      <section className="list-stage">
        <div className="section-empty-card">
          <p className="eyebrow">Favorites</p>
          <h2>No saved spots yet</h2>
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
          <p className="eyebrow">Favorites</p>
          <h2>Saved places</h2>
        </div>
        <span className="section-badge">{favorites.length}</span>
      </div>

      <div className="spot-list">
        {favorites.map((spot) => {
          const conditions = buildCurrentConditions(spot);

          return (
            <article key={spot.id} className="list-spot-card">
              <button type="button" className="list-spot-main" onClick={() => onOpen(spot)}>
                <div>
                  <h3>{spot.name}</h3>
                  <p>{formatLatLng(spot.latitude, spot.longitude)}</p>
                  <p>{conditions.buoyLabel}</p>
                </div>

                <div className="list-spot-side">
                  <strong>{conditions.clarityRange}</strong>
                  <span>{conditions.clarityLabel}</span>
                </div>
              </button>

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
        })}
      </div>
    </section>
  );
}
