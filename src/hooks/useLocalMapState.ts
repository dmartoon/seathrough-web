import { useEffect, useState } from "react";
import type { MapViewState, PinnedSpot } from "../types/map";

const MAP_VIEW_KEY = "seathrough.map.view";
const MAP_PIN_KEY = "seathrough.map.pin";

export const DEFAULT_VIEW: MapViewState = {
  center: { lat: 33.5935, lng: -117.8733 },
  zoom: 10,
};

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalMapState() {
  const [view, setView] = useState<MapViewState>(() =>
    readLocalStorage<MapViewState>(MAP_VIEW_KEY, DEFAULT_VIEW),
  );

  const [pin, setPin] = useState<PinnedSpot | null>(() =>
    readLocalStorage<PinnedSpot | null>(MAP_PIN_KEY, null),
  );

  useEffect(() => {
    window.localStorage.setItem(MAP_VIEW_KEY, JSON.stringify(view));
  }, [view]);

  useEffect(() => {
    if (pin) {
      window.localStorage.setItem(MAP_PIN_KEY, JSON.stringify(pin));
    } else {
      window.localStorage.removeItem(MAP_PIN_KEY);
    }
  }, [pin]);

  return {
    view,
    setView,
    pin,
    setPin,
    clearPin: () => setPin(null),
  };
}