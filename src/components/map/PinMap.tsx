import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import type { LatLng, MapViewState, PinnedSpot } from "../../types/map";

type PinMapProps = {
  apiKey: string;
  appName: string;
  view: MapViewState;
  pin: PinnedSpot | null;
  onPinChange: (pin: PinnedSpot) => void;
  onViewChange: (view: MapViewState) => void;
  onClearPin: () => void;
};

type MapMode = "roadmap" | "hybrid";

function normalizeLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;

  const maybe = value as {
    lat?: number | (() => number);
    lng?: number | (() => number);
  };

  const lat =
    typeof maybe.lat === "function"
      ? maybe.lat()
      : typeof maybe.lat === "number"
        ? maybe.lat
        : null;

  const lng =
    typeof maybe.lng === "function"
      ? maybe.lng()
      : typeof maybe.lng === "number"
        ? maybe.lng
        : null;

  if (lat === null || lng === null) return null;

  return { lat, lng };
}

function makePin(position: LatLng, label: string) {
  const now = Date.now();

  return {
    id: `pin-${now}`,
    position,
    label,
    createdAt: now,
    updatedAt: now,
  };
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      <circle
        cx="11"
        cy="11"
        r="6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.2 16.2 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.8 12h16.4M12 3.8c2.1 2.3 3.3 5.2 3.3 8.2S14.1 17.9 12 20.2M12 3.8C9.9 6.1 8.7 9 8.7 12s1.2 5.9 3.3 8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MyLocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      <path
        d="M12 20.4c-.3 0-.58-.14-.76-.38-1.34-1.8-5.74-7.07-5.74-10.54a6.5 6.5 0 1 1 13 0c0 3.47-4.4 8.75-5.74 10.54a.95.95 0 0 1-.76.38Zm0-14.88A3.98 3.98 0 0 0 8.02 9.5c0 1.8 2.04 4.95 3.98 7.44 1.94-2.49 3.98-5.64 3.98-7.44A3.98 3.98 0 0 0 12 5.52Zm0 6.52a2.02 2.02 0 1 1 0-4.04 2.02 2.02 0 0 1 0 4.04Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DraggablePin({
  pin,
  onPinChange,
}: {
  pin: PinnedSpot | null;
  onPinChange: (pin: PinnedSpot) => void;
}) {
  const map = useMap();
  const markerRef = useRef<any>(null);
  const pinRef = useRef<PinnedSpot | null>(pin);

  pinRef.current = pin;

  useEffect(() => {
    const googleMaps = (window as Window & { google?: any }).google?.maps;

    if (!map || !googleMaps) return;

    if (!pin) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new googleMaps.Marker({
        map,
        position: pin.position,
        draggable: true,
        title: pin.label,
      });

      markerRef.current.addListener("dragend", (event: any) => {
        const nextPosition = normalizeLatLng(event?.latLng);
        const currentPin = pinRef.current;

        if (!nextPosition || !currentPin) return;

        onPinChange({
          ...currentPin,
          position: nextPosition,
          updatedAt: Date.now(),
        });
      });
    }

    markerRef.current.setMap(map);
    markerRef.current.setPosition(pin.position);
    markerRef.current.setTitle(pin.label);
  }, [map, pin, onPinChange]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, []);

  return null;
}

function MapChrome({
  appName,
  mapMode,
  onMapModeToggle,
  onPinChange,
  onViewChange,
}: {
  appName: string;
  mapMode: MapMode;
  onMapModeToggle: () => void;
  onPinChange: (pin: PinnedSpot) => void;
  onViewChange: (view: MapViewState) => void;
}) {
  const map = useMap();
  const geocoderRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const satelliteActive = mapMode === "hybrid";

  useEffect(() => {
    const googleMaps = (window as Window & { google?: any }).google?.maps;

    if (googleMaps && !geocoderRef.current) {
      geocoderRef.current = new googleMaps.Geocoder();
    }
  }, []);

  const applyMapState = (center: LatLng, zoom: number) => {
    onViewChange({ center, zoom });
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (!query) return;

    const geocoder = geocoderRef.current;
    if (!geocoder) {
      setStatus("Map search is not ready yet.");
      return;
    }

    geocoder.geocode({ address: query }, (results: any, statusCode: string) => {
      if (statusCode !== "OK" || !results?.length) {
        setStatus("Place not found.");
        return;
      }

      const match = results[0];
      const position = normalizeLatLng(match.geometry?.location);

      if (!position) {
        setStatus("Place not found.");
        return;
      }

      const zoom = 14;
      map?.panTo(position);
      map?.setZoom?.(zoom);
      map?.setHeading?.(0);
      map?.setTilt?.(0);

      applyMapState(position, zoom);
      onPinChange(makePin(position, match.formatted_address || query));
      setStatus(null);
    });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const zoom = 14;

        map?.panTo(next);
        map?.setZoom?.(zoom);

        applyMapState(next, zoom);
        onPinChange(makePin(next, "My location"));
        setStatus(null);
      },
      (error) => {
        setStatus(error.message || "Unable to get your location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  return (
    <>
      <div className="map-overlay-top" aria-label={`${appName} map controls`}>
        <form className="map-search" onSubmit={handleSearch} role="search" aria-label="Search places">
          <button className="search-leading" type="submit" aria-label="Search place">
            <SearchIcon />
          </button>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="map-search-input"
            placeholder="Search place"
            autoComplete="off"
            enterKeyHint="search"
          />
        </form>

        <div className="map-top-actions">
          <button
            className={satelliteActive ? "map-circle-button active" : "map-circle-button"}
            type="button"
            onClick={onMapModeToggle}
            aria-label={satelliteActive ? "Show standard map" : "Show satellite view"}
            title={satelliteActive ? "Standard map" : "Satellite view"}
          >
            <GlobeIcon />
          </button>
        </div>
      </div>

      <div className="map-overlay-bottom-right" aria-label="Location controls">
        <button
          className="map-circle-button accent"
          type="button"
          onClick={handleUseMyLocation}
          aria-label="Use my location"
          title="Use my location"
        >
          <MyLocationIcon />
        </button>
      </div>

      {status ? <div className="floating-status-card error">{status}</div> : null}
    </>
  );
}

export function PinMap({
  apiKey,
  appName,
  view,
  pin,
  onPinChange,
  onViewChange,
}: PinMapProps) {
  const [mapMode, setMapMode] = useState<MapMode>("roadmap");

  return (
    <APIProvider apiKey={apiKey}>
      <div className="map-canvas ios-map-canvas">
        <Map
          className="map-surface"
          center={view.center}
          zoom={view.zoom}
          mapTypeId={mapMode}
          gestureHandling="greedy"
          disableDefaultUI={true}
          clickableIcons={false}
          streetViewControl={false}
          fullscreenControl={false}
          mapTypeControl={false}
          onClick={(event: any) => {
            const latLng = normalizeLatLng(event?.detail?.latLng ?? event?.latLng);

            if (!latLng) return;

            const now = Date.now();

            onPinChange({
              id: `pin-${now}`,
              position: latLng,
              label: "Dropped pin",
              createdAt: pin?.createdAt ?? now,
              updatedAt: now,
            });
          }}
          onCameraChanged={(event: any) => {
            const center = normalizeLatLng(event?.detail?.center);
            const zoom = event?.detail?.zoom;

            if (!center || typeof zoom !== "number") return;

            onViewChange({ center, zoom });
          }}
        />

        <DraggablePin pin={pin} onPinChange={onPinChange} />
        <MapChrome
          appName={appName}
          mapMode={mapMode}
          onMapModeToggle={() =>
            setMapMode((current) => (current === "roadmap" ? "hybrid" : "roadmap"))
          }
          onPinChange={onPinChange}
          onViewChange={onViewChange}
        />
      </div>
    </APIProvider>
  );
}
