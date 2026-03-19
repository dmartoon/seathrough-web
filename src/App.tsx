import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./index.css";
import { MapSpotCard } from "./components/map/MapSpotCard";
import { PinMap } from "./components/map/PinMap";
import {
  buildPlannedDive,
  findMatchingFavorite,
  makeSavedSpotFromMapPin,
  makeSavedSpotFromPlannedDive,
} from "./domain/spotHelpers";
import type { PinnedSpot as SavedSpot } from "./domain/types";
import { FavoritesTab } from "./features/favorites/FavoritesTab";
import { ForecastDetailScreen } from "./features/forecast/ForecastDetailScreen";
import { PlannedTab } from "./features/planned/PlannedTab";
import { useLocalMapState } from "./hooks/useLocalMapState";
import { useFavoritesStore } from "./stores/useFavoritesStore";
import { usePlannedDivesStore } from "./stores/usePlannedDivesStore";
import type { PinnedSpot as MapPin } from "./types/map";

type TabKey = "map" | "favorites" | "planned";

type AppConfig = {
  appName: string;
  publicGoogleMapsApiKey: string;
};

type DetailState = {
  spot: SavedSpot;
  initialSlotTime?: string | null;
};

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon-svg">
      <path
        d="M12 3.2l2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 17.5l-5.6 2.94 1.07-6.24L2.94 9.78l6.26-.91L12 3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon-svg">
      <rect
        x="3.5"
        y="5.5"
        width="13"
        height="15"
        rx="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3.5 10.2h13" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 3.8v3.4M12.5 3.8v3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="19" cy="16.8" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19 14.8v2.2l1.5 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon-svg">
      <path
        d="M3.8 6.2 8.9 4l6.2 2.2 5-2v15.4l-5 2-6.2-2.2-5 2V6.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.9 4v15.2M15.1 6.2v15.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      <path
        d="M6 7.2h12M6 12h12M6 16.8h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      className={active ? "tab active" : "tab"}
      onClick={onClick}
      type="button"
      aria-pressed={active}
    >
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("map");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFavoriteMapId, setSelectedFavoriteMapId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<DetailState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { view, setView, pin, setPin, clearPin } = useLocalMapState();
  const favorites = useFavoritesStore();
  const planned = usePlannedDivesStore();

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

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const appName = config?.appName ?? "SeaThrough";

  const selectedPinSpot = useMemo(() => (pin ? makeSavedSpotFromMapPin(pin) : null), [pin]);
  const activeMapFavorite = selectedPinSpot
    ? findMatchingFavorite(favorites.spots, selectedPinSpot)
    : undefined;

  const saveFavorite = useCallback(
    (spot: SavedSpot) => {
      const existing = findMatchingFavorite(favorites.spots, spot);

      favorites.addOrReplace({
        ...spot,
        id: existing?.id ?? spot.id,
        name: existing?.name ?? spot.name,
        createdAt: existing?.createdAt ?? spot.createdAt,
        updatedAt: new Date().toISOString(),
      });
    },
    [favorites],
  );

  const removeFavorite = useCallback(
    (spot: SavedSpot) => {
      const existing = findMatchingFavorite(favorites.spots, spot);
      if (!existing) return;

      favorites.remove(existing.id);
      if (selectedFavoriteMapId === existing.id) {
        setSelectedFavoriteMapId(null);
      }
    },
    [favorites, selectedFavoriteMapId],
  );

  const toggleFavorite = useCallback(
    (spot: SavedSpot) => {
      const existing = findMatchingFavorite(favorites.spots, spot);

      if (existing) {
        removeFavorite(existing);
        return;
      }

      saveFavorite(spot);
    },
    [favorites.spots, removeFavorite, saveFavorite],
  );

  const addPlannedDive = useCallback(
    (spot: SavedSpot, slotTime: string) => {
      const matchedFavorite = findMatchingFavorite(favorites.spots, spot);
      const canonicalSpot = matchedFavorite ?? spot;
      planned.add(buildPlannedDive(canonicalSpot, slotTime));
    },
    [favorites.spots, planned],
  );

  const openDetail = useCallback((spot: SavedSpot, initialSlotTime?: string | null) => {
    setDetailState({ spot, initialSlotTime });
  }, []);

  const handlePinChange = useCallback(
    (nextPin: MapPin) => {
      setSelectedFavoriteMapId(null);
      setPin(nextPin);
    },
    [setPin],
  );

  const renameSelectedPin = useCallback(
    (nextName: string) => {
      if (!pin) return;

      setPin({
        ...pin,
        label: nextName,
        updatedAt: Date.now(),
      });
    },
    [pin, setPin],
  );

  const handleFavoriteSelectOnMap = useCallback(
    (spot: SavedSpot) => {
      clearPin();
      setSelectedFavoriteMapId(spot.id);
    },
    [clearPin],
  );

  const renderMainContent = () => {
    if (detailState) {
      const detailFavorite = findMatchingFavorite(favorites.spots, detailState.spot);
      const detailSpot = detailFavorite ?? detailState.spot;

      return (
        <ForecastDetailScreen
          spot={detailSpot}
          initialSlotTime={detailState.initialSlotTime}
          isFavorite={Boolean(detailFavorite)}
          plannedDives={planned.dives}
          onBack={() => setDetailState(null)}
          onToggleFavorite={() => toggleFavorite(detailSpot)}
          onPlanDive={(slotTime) => addPlannedDive(detailSpot, slotTime)}
        />
      );
    }

    if (tab === "map") {
      return config?.publicGoogleMapsApiKey ? (
        <div className="map-stage">
          <PinMap
            apiKey={config.publicGoogleMapsApiKey}
            appName={appName}
            view={view}
            pin={pin}
            favorites={favorites.spots}
            onPinChange={handlePinChange}
            onViewChange={setView}
            onFavoriteSelect={handleFavoriteSelectOnMap}
            onClearPin={clearPin}
          />

          {selectedPinSpot ? (
            <div className="map-popup-dock">
              <MapSpotCard
                spot={selectedPinSpot}
                isFavorite={Boolean(activeMapFavorite)}
                onOpenDetail={() => openDetail(activeMapFavorite ?? selectedPinSpot)}
                onToggleFavorite={() => toggleFavorite(selectedPinSpot)}
                onRename={renameSelectedPin}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="placeholder-stage centered-stage">
          <div className="details-card centered-card">
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
        <FavoritesTab
          favorites={favorites.spots}
          onOpen={(spot) => openDetail(spot)}
          onRemove={removeFavorite}
        />
      );
    }

    return (
      <PlannedTab
        dives={planned.dives}
        onOpen={(dive) => openDetail(makeSavedSpotFromPlannedDive(dive), dive.slotTime)}
        onRemove={(dive) => planned.remove(dive.id)}
      />
    );
  };

  return (
    <div className="app-shell ios-shell">
      <header className="brand-header">
        <div className="brand-lockup">
          <img src="/assets/app-icon.png" alt="" className="brand-logo" />
          <span className="brand-name">{appName}</span>
        </div>

        <div className="menu-shell app-menu-shell" ref={menuRef}>
          <button
            className={menuOpen ? "map-circle-button active" : "map-circle-button"}
            type="button"
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            title="Menu"
          >
            <MenuIcon />
          </button>

          {menuOpen ? (
            <div className="menu-popover" role="menu" aria-label={`${appName} menu`}>
              <a
                className="menu-link"
                href="https://www.seathrough.app/privacy/"
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                Privacy Policy
              </a>
              <a
                className="menu-link primary"
                href="https://apps.apple.com/ca/app/seathrough/id6758314434"
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                Download iOS App
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <main className="app-body ios-body">{renderMainContent()}</main>

      {!detailState ? (
        <nav className="tabbar floating-tabbar" aria-label="Primary navigation">
          <TabButton
            label="Favorites"
            active={tab === "favorites"}
            onClick={() => setTab("favorites")}
            icon={<StarIcon />}
          />
          <TabButton
            label="Planned"
            active={tab === "planned"}
            onClick={() => setTab("planned")}
            icon={<CalendarIcon />}
          />
          <TabButton
            label="Map"
            active={tab === "map"}
            onClick={() => setTab("map")}
            icon={<MapIcon />}
          />
        </nav>
      ) : null}
    </div>
  );
}
