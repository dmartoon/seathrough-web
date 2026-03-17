import { useEffect, useState } from "react";
import "./index.css";
import { PinMap } from "./components/map/PinMap";
import { useLocalMapState } from "./hooks/useLocalMapState";
import type { LatLng, PinnedSpot } from "./types/map";

type TabKey = "map" | "favorites" | "planned";

type AppConfig = {
  appName: string;
  publicGoogleMapsApiKey: string;
};

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
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const { view, setView, pin, setPin, clearPin } = useLocalMapState();

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Config request failed: ${response.status}`);
        }

        const data = (await response.json()) as AppConfig;

        if (!cancelled) {
          setConfig(data);
          setConfigError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setConfig(null);
          setConfigError(
            error instanceof Error ? error.message : "Unable to load app config.",
          );
        }
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const renderMainContent = () => {
    if (tab === "map") {
      return config?.publicGoogleMapsApiKey ? (
        <div className="map-stage">
          <div className="map-panel full-bleed-map">
            <PinMap
              apiKey={config.publicGoogleMapsApiKey}
              view={view}
              pin={pin}
              onPinChange={setPin}
              onViewChange={setView}
            />
          </div>

          <div className="floating-map-actions">
            <button className="map-action-button primary" onClick={useMyLocation}>
              Use my location
            </button>
            <button
              className="map-action-button"
              onClick={clearPin}
              disabled={!pin}
            >
              Clear pin
            </button>
          </div>

          {locationError ? (
            <div className="floating-status-card error">{locationError}</div>
          ) : pin ? (
            <div className="floating-status-card">
              Pin selected · {pin.position.lat.toFixed(4)}, {pin.position.lng.toFixed(4)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="placeholder-stage">
          <div className="missing-key-card centered-card">
            <p className="eyebrow">
              {configError ? "Config load failed" : "Google Maps key missing"}
            </p>
            <h2>Add PUBLIC_GOOGLE_MAPS_API_KEY</h2>
            <p className="helper-text">
              Set the Worker runtime variable and expose it through <code>/api/config</code>.
            </p>
            {configError ? <p className="helper-text">{configError}</p> : null}
          </div>
        </div>
      );
    }

    if (tab === "favorites") {
      return (
        <div className="placeholder-stage">
          <div className="details-card centered-card">
            <p className="eyebrow">Favorites</p>
            <h2>Coming next</h2>
            <p className="helper-text">
              Saved pins will live here once the map interaction is locked in.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="placeholder-stage">
        <div className="details-card centered-card">
          <p className="eyebrow">Planned</p>
          <h2>Coming next</h2>
          <p className="helper-text">
            Planned dives will be created from saved pins after the forecast step.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell minimal-shell">
      <header className="topbar minimal-topbar">
        <div className="brand-lockup">
          <img
            className="brand-logo"
            src="/assets/app-icon.png"
            alt="SeaThrough app icon"
          />
          <span className="brand-name">{config?.appName ?? "SeaThrough"}</span>
        </div>
      </header>

      <main className="app-body map-first-body">
        {renderMainContent()}

        <nav className="tabbar floating-tabbar" aria-label="Primary navigation">
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
          <button
            className={tab === "map" ? "tab active" : "tab"}
            onClick={() => setTab("map")}
          >
            Map
          </button>
        </nav>
      </main>
    </div>
  );
}
