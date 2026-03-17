import { useMemo, useState } from "react";
import type { DiveLocation } from "../../domain/types";

type MapTabProps = {
  locations: DiveLocation[];
  apiStatus: string;
  onSaveFavorite: (location: DiveLocation) => void;
  onPlanDive: (location: DiveLocation, slotTime: string) => void;
};

function nextWholeHourIso(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }
  return next.toISOString();
}

export function MapTab({
  locations,
  apiStatus,
  onSaveFavorite,
  onPlanDive,
}: MapTabProps) {
  const [query, setQuery] = useState("");
  const [locationStatus, setLocationStatus] = useState("Location not requested yet.");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return locations;

    return locations.filter((location) =>
      location.name.toLowerCase().includes(normalized),
    );
  }, [locations, query]);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("Geolocation is not available in this browser.");
      return;
    }

    setLocationStatus("Requesting precise location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus(
          `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
        );
      },
      (error) => {
        setLocationStatus(error.message || "Unable to get your location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      },
    );
  };

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Map</h2>
            <p className="muted">
              First-step smoke test before wiring Google Maps and dropped-pin
              behavior.
            </p>
          </div>
          <span className="badge">API: {apiStatus}</span>
        </div>

        <div className="actions-row">
          <button className="primary-button" onClick={requestLocation}>
            Use my location
          </button>
          <span className="muted small">{locationStatus}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Supported Spots</h2>
            <p className="muted">Starter subset for smoke testing.</p>
          </div>
          <span className="badge">{filtered.length}</span>
        </div>

        <label className="field-label" htmlFor="spot-search">
          Search spots
        </label>
        <input
          id="spot-search"
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Crystal Cove, La Jolla, Malibu..."
        />

        <div className="stack top-space">
          {filtered.map((location) => {
            const nextSlot = nextWholeHourIso();

            return (
              <article className="card" key={location.id}>
                <div className="card-row wrap">
                  <div>
                    <h3>{location.name}</h3>
                    <p className="muted small">
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </p>
                    <p className="muted small">
                      Buoy {location.buoyId} · Tide {location.tideStation}
                    </p>
                  </div>

                  <div className="actions-row right">
                    <button
                      className="ghost-button"
                      onClick={() => onSaveFavorite(location)}
                    >
                      Save favorite
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => onPlanDive(location, nextSlot)}
                    >
                      Plan next hour
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
