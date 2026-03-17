import type { PinnedSpot } from "../../domain/types";

type FavoritesTabProps = {
  favorites: PinnedSpot[];
  onRemove: (id: string) => void;
};

export function FavoritesTab({ favorites, onRemove }: FavoritesTabProps) {
  if (favorites.length === 0) {
    return (
      <section className="panel">
        <h2>Favorites</h2>
        <p className="muted">
          No saved spots yet. Use the Map tab to save supported locations into
          local browser storage.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Favorites</h2>
          <p className="muted">Stored locally in this browser only.</p>
        </div>
        <span className="badge">{favorites.length}</span>
      </div>

      <div className="stack">
        {favorites.map((spot) => (
          <article className="card" key={spot.id}>
            <div className="card-row">
              <div>
                <h3>{spot.name}</h3>
                <p className="muted small">
                  {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}
                </p>
                <p className="muted small">
                  Buoy {spot.buoyId} · Tide {spot.tideStation}
                </p>
              </div>

              <button className="ghost-button" onClick={() => onRemove(spot.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
