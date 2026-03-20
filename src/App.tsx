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
import { SafetyNoticeScreen } from "./features/safety/SafetyNoticeScreen";
import { useLocalMapState } from "./hooks/useLocalMapState";
import { useFavoritesStore } from "./stores/useFavoritesStore";
import { usePlannedDivesStore } from "./stores/usePlannedDivesStore";
import type { LatLng, PinnedSpot as MapPin } from "./types/map";

type TabKey = "map" | "favorites" | "planned";

type AppConfig = {
  appName: string;
  publicGoogleMapsApiKey: string;
};

type DetailState = {
  spot: SavedSpot;
  initialSlotTime?: string | null;
};

type MapAlertState = {
  title: string;
  message: string;
  coordinate?: LatLng | null;
  mailtoUrl?: string | null;
};

const SAFETY_NOTICE_STORAGE_KEY = "st_hasSeenSafetyDisclaimer";

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
  const [safetyPageOpen, setSafetyPageOpen] = useState(false);
  const [hasSeenSafetyNotice, setHasSeenSafetyNotice] = useState<boolean | null>(null);
  const [mapDropChecking, setMapDropChecking] = useState(false);
  const [mapAlert, setMapAlert] = useState<MapAlertState | null>(null);
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
    try {
      setHasSeenSafetyNotice(window.localStorage.getItem(SAFETY_NOTICE_STORAGE_KEY) === "true");
    } catch {
      setHasSeenSafetyNotice(true);
    }
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
  const showSafetyNoticeGate = hasSeenSafetyNotice === false;
  const showEmptyMapLongPressHint = tab === "map" && !pin && favorites.spots.length === 0;

  const acknowledgeSafetyNotice = useCallback(() => {
    try {
      window.localStorage.setItem(SAFETY_NOTICE_STORAGE_KEY, "true");
    } catch {
      // ignore storage write failures
    }

    setHasSeenSafetyNotice(true);
  }, []);

  const selectedPinSpot = useMemo(() => (pin ? makeSavedSpotFromMapPin(pin) : null), [pin]);
  const selectedMapFavorite = useMemo(
    () => favorites.spots.find((spot) => spot.id === selectedFavoriteMapId) ?? null,
    [favorites.spots, selectedFavoriteMapId],
  );
  const activePopupSpot = selectedMapFavorite ?? selectedPinSpot;
  const activeMapFavorite = activePopupSpot
    ? findMatchingFavorite(favorites.spots, activePopupSpot)
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

  const togglePlannedDive = useCallback(
    (spot: SavedSpot, slotTime: string) => {
      const matchedFavorite = findMatchingFavorite(favorites.spots, spot);
      const canonicalSpot = matchedFavorite ?? spot;
      const existing = planned.dives.find(
        (dive) =>
          dive.spotId === canonicalSpot.id &&
          new Date(dive.slotTime).getTime() === new Date(slotTime).getTime(),
      );

      if (existing) {
        planned.remove(existing.id);
        return;
      }

      planned.add(buildPlannedDive(canonicalSpot, slotTime));
    },
    [favorites.spots, planned],
  );

  const renameSpotEverywhere = useCallback(
    (spotId: string, nextName: string) => {
      favorites.rename(spotId, nextName);
      planned.renameSpot(spotId, nextName);
    },
    [favorites, planned],
  );

  const clearMapSelection = useCallback(() => {
    setSelectedFavoriteMapId(null);
    clearPin();
    setMapDropChecking(false);
    setMapAlert(null);
  }, [clearPin]);

  const handleInvalidDrop = useCallback((message: string) => {
    setMapDropChecking(false);
    setMapAlert({
      title: "Can’t drop a pin here",
      message,
    });
  }, []);

  const handleOutOfCoverage = useCallback((coordinate: LatLng, mailtoUrl: string) => {
    setSelectedFavoriteMapId(null);
    clearPin();
    setMapDropChecking(false);
    setMapAlert({
      title: "No data available for this location",
      message:
        "SeaThrough doesn’t have coverage for this spot yet. Tap “Request location data” to send the coordinates.",
      coordinate,
      mailtoUrl,
    });
  }, [clearPin]);

  const openDetail = useCallback((spot: SavedSpot, initialSlotTime?: string | null) => {
    setSafetyPageOpen(false);
    setDetailState({ spot, initialSlotTime });
  }, []);

  const goToMapHome = useCallback(() => {
    setDetailState(null);
    setSafetyPageOpen(false);
    setMenuOpen(false);
    setMapAlert(null);
    setMapDropChecking(false);
    setTab("map");
  }, []);

  const handlePinChange = useCallback(
    (nextPin: MapPin) => {
      setMapAlert(null);
      setMapDropChecking(false);
      setSelectedFavoriteMapId(null);
      setPin(nextPin);
    },
    [setPin],
  );

  const renameActiveMapSpot = useCallback(
    (nextName: string) => {
      if (selectedMapFavorite) {
        renameSpotEverywhere(selectedMapFavorite.id, nextName);
        return;
      }

      if (!pin) return;

      setPin({
        ...pin,
        label: nextName,
        updatedAt: Date.now(),
      });
      planned.renameSpot(pin.id, nextName);

      if (activeMapFavorite) {
        renameSpotEverywhere(activeMapFavorite.id, nextName);
      }
    },
    [activeMapFavorite, pin, planned, renameSpotEverywhere, selectedMapFavorite, setPin],
  );

  const handleFavoriteSelectOnMap = useCallback(
    (spot: SavedSpot) => {
      clearPin();
      setMapAlert(null);
      setMapDropChecking(false);
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
          onRename={(nextName) => {
            const trimmed = nextName.trim();
            if (!trimmed) return;

            setDetailState((current) =>
              current
                ? {
                    ...current,
                    spot: {
                      ...current.spot,
                      name: trimmed,
                      updatedAt: new Date().toISOString(),
                    },
                  }
                : current,
            );

            renameSpotEverywhere(detailSpot.id, trimmed);
          }}
          onTogglePlanDive={(slotTime) => togglePlannedDive(detailSpot, slotTime)}
        />
      );
    }

    if (safetyPageOpen) {
      return (
        <SafetyNoticeScreen
          onAcknowledge={() => {
            acknowledgeSafetyNotice();
            setSafetyPageOpen(false);
          }}
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
            onInvalidDrop={handleInvalidDrop}
            onOutOfCoverage={handleOutOfCoverage}
            onDropValidationChange={setMapDropChecking}
            onMapBackgroundClick={clearMapSelection}
          />

          {activePopupSpot ? (
            <div className="map-popup-dock">
              <MapSpotCard
                spot={activePopupSpot}
                isFavorite={Boolean(activeMapFavorite)}
                onOpenDetail={() => openDetail(activeMapFavorite ?? activePopupSpot)}
                onToggleFavorite={() => toggleFavorite(activePopupSpot)}
                onRename={renameActiveMapSpot}
              />
            </div>
          ) : null}

          {showEmptyMapLongPressHint ? (
            <div className="map-empty-hint" aria-live="polite">
              <div className="map-empty-hint-card">Hold near shore to drop a pin.</div>
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
          onRename={(spot, nextName) => renameSpotEverywhere(spot.id, nextName)}
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
      {!safetyPageOpen ? (
        <header className="brand-header">
          <button
            type="button"
            className="brand-home-button"
            onClick={goToMapHome}
            aria-label={`Go to ${appName} map`}
          >
            <span className="brand-lockup">
              <img src="/assets/app-icon.png" alt="" className="brand-logo" draggable={false} />
              <span className="brand-name">{appName}</span>
            </span>
          </button>

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
                <button
                  type="button"
                  className="menu-link menu-link-button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setDetailState(null);
                    setSafetyPageOpen(true);
                  }}
                >
                  Safety Notice
                </button>
                <a
                  className="menu-link"
                  href="mailto:support@seathrough.app?subject=SeaThrough%20Feedback"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  Contact
                </a>
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
      ) : null}

      <main className="app-body ios-body">{renderMainContent()}</main>

      {tab === "map" && mapDropChecking ? (
        <div className="map-drop-status" aria-live="polite">
          <div className="map-drop-status-card">
            <div className="map-drop-spinner" aria-hidden="true" />
            <div>Checking shoreline…</div>
          </div>
        </div>
      ) : null}

      {tab === "map" && mapAlert ? (
        <div className="map-drop-alert-overlay" role="dialog" aria-modal="true" aria-label={mapAlert.title}>
          <div className="map-drop-alert-card">
            <h2>{mapAlert.title}</h2>
            <p>{mapAlert.message}</p>
            <div className="map-drop-alert-actions">
              {mapAlert.mailtoUrl ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      window.location.href = mapAlert.mailtoUrl ?? "mailto:support@seathrough.app";
                      setMapAlert(null);
                    }}
                  >
                    Request location data
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setMapAlert(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="primary-button" onClick={() => setMapAlert(null)}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!detailState && !safetyPageOpen ? (
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

      {showSafetyNoticeGate ? (
        <SafetyNoticeScreen inModal onAcknowledge={acknowledgeSafetyNotice} />
      ) : null}
    </div>
  );
}
