import { useEffect, useMemo, useState } from "react";
import { FavoritesTab } from "./features/favorites/FavoritesTab";
import { MapTab } from "./features/map/MapTab";
import { PlannedTab } from "./features/planned/PlannedTab";
import { SUPPORTED_LOCATIONS } from "./data/supportedLocations";
import type { DiveLocation, PinnedSpot, PlannedDive } from "./domain/types";
import { useFavoritesStore } from "./stores/useFavoritesStore";
import { usePlannedDivesStore } from "./stores/usePlannedDivesStore";

type RootTab = "favorites" | "planned" | "map";

function toPinnedSpot(location: DiveLocation): PinnedSpot {
  const now = new Date().toISOString();

  return {
    id: location.id,
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    buoyId: location.buoyId,
    tideStation: location.tideStation,
    shoreDirection: location.shoreDirection,
    region: location.region,
    source: "supported",
    createdAt: now,
    updatedAt: now,
  };
}

function toPlannedDive(location: DiveLocation, slotTime: string): PlannedDive {
  return {
    id: crypto.randomUUID(),
    spotId: location.id,
    spotName: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    buoyId: location.buoyId,
    tideStation: location.tideStation,
    shoreDirection: location.shoreDirection,
    region: location.region,
    slotTime,
    createdAt: new Date().toISOString(),
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<RootTab>("favorites");
  const [apiStatus, setApiStatus] = useState("checking");

  const favorites = useFavoritesStore();
  const planned = usePlannedDivesStore();

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API status ${response.status}`);
        }
        await response.json();
        setApiStatus("ok");
      })
      .catch(() => {
        setApiStatus("offline");
      });

    return () => controller.abort();
  }, []);

  const activeScreen = useMemo(() => {
    switch (activeTab) {
      case "favorites":
        return (
          <FavoritesTab
            favorites={favorites.spots}
            onRemove={favorites.remove}
          />
        );
      case "planned":
        return <PlannedTab dives={planned.dives} onRemove={planned.remove} />;
      case "map":
        return (
          <MapTab
            locations={SUPPORTED_LOCATIONS}
            apiStatus={apiStatus}
            onSaveFavorite={(location) => favorites.addOrReplace(toPinnedSpot(location))}
            onPlanDive={(location, slotTime) =>
              planned.add(toPlannedDive(location, slotTime))
            }
          />
        );
      default:
        return null;
    }
  }, [activeTab, apiStatus, favorites, planned]);

  return (
    <div className="app-shell">
      <header className="hero panel">
        <div>
          <p className="eyebrow">SeaThrough Web</p>
          <h1>Local-only web shell</h1>
          <p className="muted hero-copy">
            This first commit mirrors the iPhone app structure: Favorites,
            Planned, and Map, with browser-local persistence and a Cloudflare
            Worker API entrypoint.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-label">Favorites</span>
            <strong>{favorites.spots.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Planned</span>
            <strong>{planned.dives.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">API</span>
            <strong>{apiStatus}</strong>
          </div>
        </div>
      </header>

      <nav className="tabs panel" aria-label="Primary">
        <button
          className={activeTab === "favorites" ? "tab active" : "tab"}
          onClick={() => setActiveTab("favorites")}
        >
          Favorites
        </button>
        <button
          className={activeTab === "planned" ? "tab active" : "tab"}
          onClick={() => setActiveTab("planned")}
        >
          Planned
        </button>
        <button
          className={activeTab === "map" ? "tab active" : "tab"}
          onClick={() => setActiveTab("map")}
        >
          Map
        </button>
      </nav>

      <main>{activeScreen}</main>
    </div>
  );
}
