import { useEffect, useRef, useState } from "react";
import "./index.css";
import { PinMap } from "./components/map/PinMap";
import { useLocalMapState } from "./hooks/useLocalMapState";

type TabKey = "map" | "favorites" | "planned";

type AppConfig = {
  appName: string;
  publicGoogleMapsApiKey: string;
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
  icon: React.ReactNode;
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
  const menuRef = useRef<HTMLDivElement | null>(null);
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

  const renderMainContent = () => {
    if (tab === "map") {
      return config?.publicGoogleMapsApiKey ? (
        <div className="map-stage">
          <PinMap
            apiKey={config.publicGoogleMapsApiKey}
            appName={appName}
            view={view}
            pin={pin}
            onPinChange={setPin}
            onViewChange={setView}
            onClearPin={clearPin}
          />
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
        <div className="placeholder-stage centered-stage tab-placeholder-stage">
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
      <div className="placeholder-stage centered-stage tab-placeholder-stage">
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
    </div>
  );
}
