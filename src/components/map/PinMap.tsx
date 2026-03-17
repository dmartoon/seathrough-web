import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import type { LatLng, MapViewState, PinnedSpot } from "../../types/map";

type PinMapProps = {
  apiKey: string;
  view: MapViewState;
  pin: PinnedSpot | null;
  onPinChange: (pin: PinnedSpot) => void;
  onViewChange: (view: MapViewState) => void;
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

export function PinMap({
  apiKey,
  view,
  pin,
  onPinChange,
  onViewChange,
}: PinMapProps) {
  return (
    <APIProvider apiKey={apiKey}>
      <div className="map-canvas">
        <Map
          center={view.center}
          zoom={view.zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          mapTypeControl={true}
          streetViewControl={false}
          fullscreenControl={false}
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
      </div>
    </APIProvider>
  );
}