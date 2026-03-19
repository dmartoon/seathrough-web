import { APIProvider, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PinnedSpot as SavedSpot } from "../../domain/types";
import type { LatLng, MapViewState, PinnedSpot } from "../../types/map";

type PinMapProps = {
  apiKey: string;
  appName: string;
  view: MapViewState;
  pin: PinnedSpot | null;
  favorites: SavedSpot[];
  onPinChange: (pin: PinnedSpot) => void;
  onViewChange: (view: MapViewState) => void;
  onFavoriteSelect: (spot: SavedSpot) => void;
  onClearPin: () => void;
};

type MapMode = "roadmap" | "hybrid";

type MapProjection = {
  fromContainerPixelToLatLng: (point: unknown) => unknown;
};

type PendingPress = {
  pointerId: number;
  startedX: number;
  startedY: number;
  currentX: number;
  currentY: number;
  timerId: number;
  fired: boolean;
};

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
    const googleMaps = (window as Window & { google?: { maps?: any } }).google?.maps;

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

      markerRef.current.addListener("dragend", (event: { latLng?: unknown }) => {
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

function FavoriteMarkers({
  favorites,
  onSelect,
}: {
  favorites: SavedSpot[];
  onSelect: (spot: SavedSpot) => void;
}) {
  const map = useMap();
  const markersRef = useRef<globalThis.Map<string, any>>(new globalThis.Map());

  useEffect(() => {
    const googleMaps = (window as Window & { google?: { maps?: any } }).google?.maps;

    if (!map || !googleMaps) return;

    const activeIds = new Set(favorites.map((spot) => spot.id));

    for (const [id, marker] of markersRef.current.entries()) {
      if (!activeIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    favorites.forEach((spot) => {
      const existing = markersRef.current.get(spot.id);

      if (existing) {
        existing.setPosition({ lat: spot.latitude, lng: spot.longitude });
        existing.setTitle(spot.name);
        existing.setMap(map);
        return;
      }

      const marker = new googleMaps.Marker({
        map,
        position: { lat: spot.latitude, lng: spot.longitude },
        title: spot.name,
        icon: {
          path: googleMaps.SymbolPath.CIRCLE,
          scale: 12.5,
          fillColor: "#2480ee",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeOpacity: 0.95,
          strokeWeight: 2,
        },
        label: {
          text: "★",
          color: "#ffffff",
          fontSize: "13px",
          fontWeight: "700",
        },
      });

      marker.addListener("click", () => onSelect(spot));
      markersRef.current.set(spot.id, marker);
    });
  }, [favorites, map, onSelect]);

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.setMap(null);
      }
      markersRef.current.clear();
    };
  }, []);

  return null;
}

function ProjectionBridge({
  onProjectionReady,
}: {
  onProjectionReady: (projection: MapProjection | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const googleMaps = (window as Window & { google?: { maps?: any } }).google?.maps;

    if (!map || !googleMaps) return;

    const overlay = new googleMaps.OverlayView();

    overlay.onAdd = () => {};
    overlay.draw = () => {
      onProjectionReady((overlay.getProjection() as MapProjection | null) ?? null);
    };
    overlay.onRemove = () => {
      onProjectionReady(null);
    };

    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
      onProjectionReady(null);
    };
  }, [map, onProjectionReady]);

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
    const googleMaps = (window as Window & { google?: { maps?: any } }).google?.maps;

    if (googleMaps && !geocoderRef.current) {
      geocoderRef.current = new googleMaps.Geocoder();
    }
  }, []);

  const applyMapState = (center: LatLng, zoom: number) => {
    onViewChange({ center, zoom });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (!query) return;

    const geocoder = geocoderRef.current;
    if (!geocoder) {
      setStatus("Map search is not ready yet.");
      return;
    }

    geocoder.geocode({ address: query }, (results: any[] | null, statusCode: string) => {
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
            placeholder="Search place or long press on map"
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

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

export function PinMap({
  apiKey,
  appName,
  view,
  pin,
  favorites,
  onPinChange,
  onViewChange,
  onFavoriteSelect,
  onClearPin,
}: PinMapProps) {
  const [mapMode, setMapMode] = useState<MapMode>("roadmap");
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const projectionRef = useRef<MapProjection | null>(null);
  const pendingPressRef = useRef<PendingPress | null>(null);
  const pinRef = useRef<PinnedSpot | null>(pin);

  pinRef.current = pin;

  useEffect(() => {
    const element = mapCanvasRef.current;

    if (!element) return;

    const clearPendingPress = () => {
      const pendingPress = pendingPressRef.current;

      if (pendingPress) {
        window.clearTimeout(pendingPress.timerId);
        pendingPressRef.current = null;
      }
    };

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;

      return Boolean(
        target.closest("button, input, textarea, select, form, a, .map-overlay-top, .map-overlay-bottom-right, .map-popup-dock"),
      );
    };

    const clientPointToLatLng = (clientX: number, clientY: number) => {
      const projection = projectionRef.current;
      const googleMaps = (window as Window & { google?: { maps?: any } }).google?.maps;

      if (!projection || !googleMaps) return null;

      const bounds = element.getBoundingClientRect();
      const point = new googleMaps.Point(clientX - bounds.left, clientY - bounds.top);

      return normalizeLatLng(projection.fromContainerPixelToLatLng(point));
    };

    const dropPinAtClientPoint = (clientX: number, clientY: number) => {
      const position = clientPointToLatLng(clientX, clientY);
      if (!position) return;

      const now = Date.now();

      onPinChange({
        id: `pin-${now}`,
        position,
        label: "Dropped pin",
        createdAt: pinRef.current?.createdAt ?? now,
        updatedAt: now,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || isInteractiveTarget(event.target)) {
        return;
      }

      clearPendingPress();

      const pendingPress: PendingPress = {
        pointerId: event.pointerId,
        startedX: event.clientX,
        startedY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        timerId: 0,
        fired: false,
      };

      pendingPress.timerId = window.setTimeout(() => {
        const currentPress = pendingPressRef.current;

        if (!currentPress || currentPress.pointerId !== event.pointerId || currentPress.fired) {
          return;
        }

        currentPress.fired = true;
        dropPinAtClientPoint(currentPress.currentX, currentPress.currentY);
      }, LONG_PRESS_MS);

      pendingPressRef.current = pendingPress;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const pendingPress = pendingPressRef.current;

      if (!pendingPress || pendingPress.pointerId !== event.pointerId) return;

      pendingPress.currentX = event.clientX;
      pendingPress.currentY = event.clientY;

      const movedX = event.clientX - pendingPress.startedX;
      const movedY = event.clientY - pendingPress.startedY;
      const movedDistance = Math.hypot(movedX, movedY);

      if (!pendingPress.fired && movedDistance > MOVE_CANCEL_PX) {
        clearPendingPress();
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const pendingPress = pendingPressRef.current;

      if (!pendingPress || pendingPress.pointerId !== event.pointerId) return;

      const movedX = event.clientX - pendingPress.startedX;
      const movedY = event.clientY - pendingPress.startedY;
      const movedDistance = Math.hypot(movedX, movedY);
      const shouldClearPin = !pendingPress.fired && movedDistance <= MOVE_CANCEL_PX && Boolean(pinRef.current);

      clearPendingPress();

      if (shouldClearPin) {
        onClearPin();
      }
    };

    element.addEventListener("pointerdown", handlePointerDown, true);
    element.addEventListener("pointermove", handlePointerMove, true);
    element.addEventListener("pointerup", handlePointerEnd, true);
    element.addEventListener("pointercancel", handlePointerEnd, true);
    element.addEventListener("pointerleave", handlePointerEnd, true);

    return () => {
      clearPendingPress();
      element.removeEventListener("pointerdown", handlePointerDown, true);
      element.removeEventListener("pointermove", handlePointerMove, true);
      element.removeEventListener("pointerup", handlePointerEnd, true);
      element.removeEventListener("pointercancel", handlePointerEnd, true);
      element.removeEventListener("pointerleave", handlePointerEnd, true);
    };
  }, [onClearPin, onPinChange]);

  const handleProjectionReady = useCallback((projection: MapProjection | null) => {
    projectionRef.current = projection;
  }, []);

  return (
    <APIProvider apiKey={apiKey}>
      <div ref={mapCanvasRef} className="map-canvas ios-map-canvas">
        <GoogleMap
          className="map-surface"
          center={view.center}
          zoom={view.zoom}
          mapTypeId={mapMode}
          gestureHandling="greedy"
          disableDefaultUI={true}
          keyboardShortcuts={false}
          clickableIcons={false}
          streetViewControl={false}
          fullscreenControl={false}
          mapTypeControl={false}
          onDragstart={() => {
            const pendingPress = pendingPressRef.current;
            if (pendingPress) {
              window.clearTimeout(pendingPress.timerId);
              pendingPressRef.current = null;
            }
          }}
          onCameraChanged={(event: { detail?: { center?: unknown; zoom?: number } }) => {
            const center = normalizeLatLng(event?.detail?.center);
            const zoom = event?.detail?.zoom;

            if (!center || typeof zoom !== "number") return;

            onViewChange({ center, zoom });
          }}
        />

        <ProjectionBridge onProjectionReady={handleProjectionReady} />
        <DraggablePin pin={pin} onPinChange={onPinChange} />
        <FavoriteMarkers favorites={favorites} onSelect={onFavoriteSelect} />
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
