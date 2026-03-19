import { SUPPORTED_LOCATIONS } from "../data/supportedLocations";
import type { DiveLocation, PlannedDive, PinnedSpot as SavedSpot } from "./types";
import type { PinnedSpot as MapPin } from "../types/map";

const SAME_SPOT_EPSILON = 0.00015;

function stableHash(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function sanitizeLabel(label: string) {
  const trimmed = label.trim();
  return trimmed.length ? trimmed : "Pinned Spot";
}

export function computeDistanceScore(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const lat = latitudeA - latitudeB;
  const lng = longitudeA - longitudeB;
  return lat * lat + lng * lng;
}

export function findNearestSupportedLocation(latitude: number, longitude: number) {
  return SUPPORTED_LOCATIONS.reduce<DiveLocation>((best, candidate) => {
    const bestScore = computeDistanceScore(
      latitude,
      longitude,
      best.latitude,
      best.longitude,
    );
    const candidateScore = computeDistanceScore(
      latitude,
      longitude,
      candidate.latitude,
      candidate.longitude,
    );

    return candidateScore < bestScore ? candidate : best;
  }, SUPPORTED_LOCATIONS[0]);
}

export function makeSavedSpotFromMapPin(pin: MapPin): SavedSpot {
  const nearest = findNearestSupportedLocation(pin.position.lat, pin.position.lng);
  const label = sanitizeLabel(pin.label);
  const stamp = new Date(pin.createdAt).toISOString();
  const stableId = pin.id || `spot-${stableHash(`${pin.position.lat}:${pin.position.lng}:${label}`)}`;

  return {
    id: stableId,
    name: label,
    latitude: pin.position.lat,
    longitude: pin.position.lng,
    buoyId: nearest.buoyId,
    tideStation: nearest.tideStation,
    shoreDirection: nearest.shoreDirection,
    region: nearest.region,
    source: "custom",
    createdAt: stamp,
    updatedAt: new Date(pin.updatedAt).toISOString(),
  };
}

export function makeSavedSpotFromDiveLocation(location: DiveLocation): SavedSpot {
  const stamp = new Date().toISOString();

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
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function makeSavedSpotFromPlannedDive(dive: PlannedDive): SavedSpot {
  return {
    id: dive.spotId,
    name: dive.spotName,
    latitude: dive.latitude,
    longitude: dive.longitude,
    buoyId: dive.buoyId,
    tideStation: dive.tideStation,
    shoreDirection: dive.shoreDirection,
    region: dive.region,
    source: "custom",
    createdAt: dive.createdAt,
    updatedAt: dive.createdAt,
  };
}

export function buildPlannedDive(spot: SavedSpot, slotTime: string): PlannedDive {
  return {
    id: `planned-${spot.id}-${slotTime}`,
    spotId: spot.id,
    spotName: spot.name,
    latitude: spot.latitude,
    longitude: spot.longitude,
    buoyId: spot.buoyId,
    tideStation: spot.tideStation,
    shoreDirection: spot.shoreDirection,
    region: spot.region,
    slotTime,
    createdAt: new Date().toISOString(),
  };
}

export function areSpotsEquivalent(left: SavedSpot, right: SavedSpot) {
  if (left.id === right.id) {
    return true;
  }

  return (
    Math.abs(left.latitude - right.latitude) <= SAME_SPOT_EPSILON &&
    Math.abs(left.longitude - right.longitude) <= SAME_SPOT_EPSILON
  );
}

export function findMatchingFavorite(
  favorites: SavedSpot[],
  spot: SavedSpot,
): SavedSpot | undefined {
  return favorites.find((favorite) => areSpotsEquivalent(favorite, spot));
}

export function nextWholeHourIso(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }

  return next.toISOString();
}

export function formatLatLng(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
