import { useState } from "react";
import "./index.css";
import { PinDetailsPanel } from "./components/map/PinDetailsPanel";
import { PinMap } from "./components/map/PinMap";
import { useLocalMapState } from "./hooks/useLocalMapState";
import type { LatLng, PinnedSpot } from "./types/map";

type TabKey = "map" | "favorites" | "planned";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

function makePin(position: LatLng, label = "Dropped pin"): PinnedSpot {
  const now = Date.now();

  return {
    id: `pin-${now}`,
    position,
    label,
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("map");
  const [locationError, setLocationError] = useState<string | null>(null);
  const { view, setView, pin, setPin, clearPin } = useLocalMapState();

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setView({
          center: next,
          zoom: Math.max(view.zoom, 13),
        });

        setPin(makePin(next, "My location"));
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message || "Unable to get your location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SeaThrough web</p>
          <h1>Pin-first map shell</h1>
        </div>

        <div className="topbar-metrics">
          <div className="metric-card">
            <span>Selected pin</span>
            <strong>{pin ? "Ready" : "None"}</strong>
          </div>
          <div className="metric-card">
            <span>Center</span>
            <strong>
              {view.center.lat.toFixed(3)}, {view.center.lng.toFixed(3)}
            </strong>
          </div>
        </div>
      </header>

      <nav className="tabbar">
        <button
          className={tab === "map" ? "tab active" : "tab"}
          onClick={() => setTab("map")}
        >
          Map
        </button>
        <button
          className={tab === "favorites" ? "tab active" : "tab"}
          onClick={() => setTab("favorites")}
        >
          Favorites
        </button>
        <button
          className={tab === "planned" ? "tab active" : "tab"}
          onClick={() => setTab("planned")}
        >
          Planned
        </button>
      </nav>

      <main className="app-body">
        {tab === "map" ? (
          <section className="map-layout">
            <div className="map-panel">
              {GOOGLE_MAPS_API_KEY ? (
                <PinMap
                  apiKey={GOOGLE_MAPS_API_KEY}
                  view={view}
                  pin={pin}
                  onPinChange={setPin}
                  onViewChange={setView}
                />
              ) : (
                <div className="missing-key-card">
                  <p className="eyebrow">Google Maps key missing</p>
                  <h2>Add VITE_GOOGLE_MAPS_API_KEY</h2>
                  <p className="helper-text">
                    Create a <code>.env.local</code> file in the project root and add
                    your Google Maps JavaScript API key there.
                  </p>
                </div>
              )}
            </div>

            <PinDetailsPanel
              pin={pin}
              onUseMyLocation={useMyLocation}
              onClearPin={clearPin}
              locationError={locationError}
            />
          </section>
        ) : tab === "favorites" ? (
          <section className="placeholder-panel">
            <div className="details-card">
              <p className="eyebrow">Favorites</p>
              <h2>Coming next</h2>
              <p className="helper-text">
                Saved pins will live here once the map interaction is locked in.
              </p>
            </div>
          </section>
        ) : (
          <section className="placeholder-panel">
            <div className="details-card">
              <p className="eyebrow">Planned</p>
              <h2>Coming next</h2>
              <p className="helper-text">
                Planned dives will be created from saved pins after the forecast step.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}