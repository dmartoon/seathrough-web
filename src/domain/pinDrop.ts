import { SUPPORTED_LOCATIONS } from "../data/supportedLocations";
import type { LatLng, PinnedSpot as MapPin } from "../types/map";
import type { DiveLocation } from "./types";

export const MAX_COVERAGE_MILES = 40;
export const MAX_INLAND_MILES = 0.5;
export const MAX_OFFSHORE_MILES = 5;

const CACHE_GRID_DEGREES = 0.0002;
const VALIDATED_TTL_MS = 30 * 60 * 1000;
const VALIDATED_MAX = 200;
const BEARINGS_4 = [0, 90, 180, 270] as const;
const BEARINGS_DIAG = [45, 135, 225, 315] as const;
const OCEAN_TEXT = /\b(ocean|sea|bay|gulf|channel|strait|lagoon|reef|shoal|pacific|atlantic|cove|harbor|harbour|marine|underwater)\b/i;
const STRONG_LAND_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "intersection",
  "point_of_interest",
  "establishment",
  "park",
]);
const CLASSIFY_RETRY_DELAYS_MS = [350, 800] as const;
const MIN_GEOCODE_SPACING_MS = 140;
const MAX_FAILURE_COOLDOWN_MS = 3000;

type Surface = "ocean" | "land" | "unknown";

type ReverseGeocodeResult = {
  formatted_address?: string;
  types?: string[];
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

type ReverseGeocodeFn = (coordinate: LatLng) => Promise<ReverseGeocodeResult[]>;

type ValidatedOcean = {
  coordinate: LatLng;
  atMs: number;
};

export type DropDecision = {
  allowed: boolean;
  finalCoordinate: LatLng;
  message: string;
};

export function distanceMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const lat1 = (latitudeA * Math.PI) / 180;
  const lon1 = (longitudeA * Math.PI) / 180;
  const lat2 = (latitudeB * Math.PI) / 180;
  const lon2 = (longitudeB * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = 6_371_000 * c;

  return meters / 1609.344;
}

export function findNearestSupportedLocation(latitude: number, longitude: number) {
  return SUPPORTED_LOCATIONS.reduce<DiveLocation>((best, candidate) => {
    const bestMiles = distanceMiles(latitude, longitude, best.latitude, best.longitude);
    const candidateMiles = distanceMiles(latitude, longitude, candidate.latitude, candidate.longitude);

    return candidateMiles < bestMiles ? candidate : best;
  }, SUPPORTED_LOCATIONS[0]);
}

export function makePinnedSpot(position: LatLng, label = "Pinned Spot"): MapPin {
  const now = Date.now();

  return {
    id: `pin-${now}`,
    position,
    label,
    createdAt: now,
    updatedAt: now,
  };
}

export function coverageRequestMailtoUrl(
  coordinate: LatLng,
  supportEmail = "support@seathrough.app",
) {
  const latitude = coordinate.lat.toFixed(6);
  const longitude = coordinate.lng.toFixed(6);
  const subject = "SeaThrough — Location data request";
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const body = [
    "Location data request",
    "",
    "Requested pin coordinate:",
    `${latitude}, ${longitude}`,
    "",
    "Google Maps:",
    googleMapsUrl,
    "",
    "---",
    `Browser: ${typeof navigator === "undefined" ? "Unknown" : navigator.userAgent}`,
  ].join("\n");

  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function pickPlaceName(results: ReverseGeocodeResult[]) {
  const primaryPointOfInterest = results.find((result) =>
    result.types?.some((type) =>
      type === "point_of_interest" || type === "establishment" || type === "natural_feature",
    ),
  );
  if (primaryPointOfInterest?.formatted_address) {
    return primaryPointOfInterest.formatted_address.split(",")[0]?.trim() ?? null;
  }

  const first = results[0];
  if (!first) return null;

  const components = first.address_components ?? [];
  const findComponent = (...types: string[]) =>
    components.find((component) => component.types?.some((type) => types.includes(type)))?.long_name ?? null;

  const locality = findComponent("locality");
  const state = findComponent("administrative_area_level_1");
  if (locality && state) {
    return `${locality}, ${state}`;
  }

  const sublocality = findComponent("sublocality", "sublocality_level_1", "neighborhood");
  if (sublocality && locality) {
    return `${sublocality}, ${locality}`;
  }

  const oceanMatch = [
    first.formatted_address,
    ...components.flatMap((component) => [component.long_name, component.short_name]),
  ]
    .filter((value): value is string => Boolean(value))
    .find((value) => OCEAN_TEXT.test(value));
  if (oceanMatch) {
    return oceanMatch;
  }

  return first.formatted_address?.split(",")[0]?.trim() ?? null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));
}

function destination(from: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const radiusMeters = 6_371_000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lon1 = (from.lng * Math.PI) / 180;
  const delta = distanceMeters / radiusMeters;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
}

export class DropValidator {
  private surfaceCache = new Map<string, Surface>();
  private validatedOceans: ValidatedOcean[] = [];
  private readonly reverseGeocode: ReverseGeocodeFn;
  private readonly maxInlandMiles: number;
  private readonly maxOffshoreMiles: number;
  private lastGeocodeAtMs = 0;
  private cooldownUntilMs = 0;
  private consecutiveFailures = 0;

  constructor(
    reverseGeocode: ReverseGeocodeFn,
    maxInlandMiles = MAX_INLAND_MILES,
    maxOffshoreMiles = MAX_OFFSHORE_MILES,
  ) {
    this.reverseGeocode = reverseGeocode;
    this.maxInlandMiles = maxInlandMiles;
    this.maxOffshoreMiles = maxOffshoreMiles;
  }

  async evaluateDrop(pressed: LatLng): Promise<DropDecision> {
    let surface = await this.classifySurface(pressed);

    if (surface === "unknown") {
      const inferred = this.inferSurfaceFromCache(pressed, 2);
      if (inferred) {
        surface = inferred;
      }
    }

    if (surface === "unknown") {
      const fallback = this.nearestValidatedOcean(pressed, 0.75);
      if (fallback) {
        this.rememberValidatedOcean(fallback);
        return { allowed: true, finalCoordinate: fallback, message: "" };
      }

      return {
        allowed: false,
        finalCoordinate: pressed,
        message: "Couldn't verify shoreline right now. Try again in a few seconds.",
      };
    }

    if (surface === "ocean") {
      const coastal = await this.ringHasLandTwoPass(pressed, this.maxOffshoreMiles);
      if (coastal) {
        this.rememberValidatedOcean(pressed);
        return { allowed: true, finalCoordinate: pressed, message: "" };
      }

      return {
        allowed: false,
        finalCoordinate: pressed,
        message: "Too far offshore. Drop pins within 5 miles of shore.",
      };
    }

    const snapped = await this.snapIntoOceanIfNearby(pressed, this.maxInlandMiles);
    if (snapped) {
      this.rememberValidatedOcean(snapped);
      return { allowed: true, finalCoordinate: snapped, message: "" };
    }

    const fallback = this.nearestValidatedOcean(pressed, this.maxInlandMiles);
    if (fallback) {
      this.rememberValidatedOcean(fallback);
      return { allowed: true, finalCoordinate: fallback, message: "" };
    }

    return {
      allowed: false,
      finalCoordinate: pressed,
      message: "Couldn't verify shoreline here. Try again closer to the coast.",
    };
  }

  private cacheKey(coordinate: LatLng) {
    const latitude = Math.round(coordinate.lat / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES;
    const longitude = Math.round(coordinate.lng / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES;
    return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  }

  private rememberSurface(coordinate: LatLng, surface: Surface) {
    if (surface === "unknown") return;

    const key = this.cacheKey(coordinate);
    this.surfaceCache.set(key, surface);

    if (this.surfaceCache.size <= 6000) return;

    const oldest = this.surfaceCache.keys().next().value;
    if (oldest) {
      this.surfaceCache.delete(oldest);
    }
  }

  private inferSurfaceFromCache(coordinate: LatLng, radiusCells: number): Surface | null {
    let oceanCount = 0;
    let landCount = 0;

    for (let y = -radiusCells; y <= radiusCells; y += 1) {
      for (let x = -radiusCells; x <= radiusCells; x += 1) {
        const probe = {
          lat: coordinate.lat + y * CACHE_GRID_DEGREES,
          lng: coordinate.lng + x * CACHE_GRID_DEGREES,
        };
        const cached = this.surfaceCache.get(this.cacheKey(probe));
        if (cached === "ocean") oceanCount += 1;
        if (cached === "land") landCount += 1;
      }
    }

    if (oceanCount === 0 && landCount === 0) {
      return null;
    }

    return oceanCount >= landCount ? "ocean" : "land";
  }

  private cachedOrInferredSurface(coordinate: LatLng): Surface | null {
    return this.surfaceCache.get(this.cacheKey(coordinate)) ?? this.inferSurfaceFromCache(coordinate, 1);
  }

  private async throttleBeforeGeocode() {
    const now = Date.now();

    if (now < this.cooldownUntilMs) {
      await sleep(this.cooldownUntilMs - now);
    }

    const nowAfterCooldown = Date.now();
    if (this.lastGeocodeAtMs !== 0) {
      const elapsed = nowAfterCooldown - this.lastGeocodeAtMs;
      if (elapsed < MIN_GEOCODE_SPACING_MS) {
        await sleep(MIN_GEOCODE_SPACING_MS - elapsed);
      }
    }

    await sleep(Math.floor(Math.random() * 26));
    this.lastGeocodeAtMs = Date.now();
  }

  private recordGeocodeSuccess() {
    this.consecutiveFailures = 0;
    this.cooldownUntilMs = 0;
  }

  private recordGeocodeFailure() {
    this.consecutiveFailures += 1;

    const exponent = Math.min(Math.max(this.consecutiveFailures - 1, 0), 3);
    const backoffMs = Math.min(MAX_FAILURE_COOLDOWN_MS, 250 * 2 ** exponent);
    this.cooldownUntilMs = Date.now() + backoffMs;
  }

  private hasOceanSignal(results: ReverseGeocodeResult[]) {
    return results.some((result) => {
      if (OCEAN_TEXT.test(result.formatted_address ?? "")) {
        return true;
      }

      return (result.address_components ?? []).some((component) =>
        OCEAN_TEXT.test(`${component.long_name ?? ""} ${component.short_name ?? ""}`),
      );
    });
  }

  private hasStrongLandSignal(results: ReverseGeocodeResult[]) {
    return results.some((result) => {
      if ((result.types ?? []).some((type) => STRONG_LAND_TYPES.has(type))) {
        return true;
      }

      return (result.address_components ?? []).some((component) =>
        component.types?.some((type) => STRONG_LAND_TYPES.has(type)),
      );
    });
  }

  private classifyFromResults(results: ReverseGeocodeResult[]): Surface {
    if (!results.length) {
      return "unknown";
    }

    if (this.hasOceanSignal(results)) {
      return "ocean";
    }

    if (this.hasStrongLandSignal(results)) {
      return "land";
    }

    return "unknown";
  }

  private async reverseGeocodeSurface(coordinate: LatLng): Promise<Surface> {
    await this.throttleBeforeGeocode();

    try {
      const results = await this.reverseGeocode(coordinate);
      const surface = this.classifyFromResults(results);
      this.recordGeocodeSuccess();
      return surface;
    } catch {
      this.recordGeocodeFailure();
      return "unknown";
    }
  }

  private async classifySurface(coordinate: LatLng): Promise<Surface> {
    const cached = this.cachedOrInferredSurface(coordinate);
    if (cached) {
      return cached;
    }

    for (let attempt = 0; attempt <= CLASSIFY_RETRY_DELAYS_MS.length; attempt += 1) {
      const surface = await this.reverseGeocodeSurface(coordinate);
      this.rememberSurface(coordinate, surface);

      if (surface !== "unknown") {
        return surface;
      }

      const delayMs = CLASSIFY_RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined) {
        break;
      }

      await sleep(delayMs);
    }

    return "unknown";
  }

  private async ringHasLand(center: LatLng, radiusMiles: number, bearings: readonly number[]) {
    const meters = radiusMiles * 1609.344;

    for (const bearing of bearings) {
      const probe = destination(center, bearing, meters);
      const hinted = this.cachedOrInferredSurface(probe);
      if (hinted === "land") {
        return true;
      }
      if (hinted === "ocean") {
        continue;
      }

      const surface = await this.classifySurface(probe);
      if (surface === "land") {
        return true;
      }
    }

    return false;
  }

  private async ringHasLandTwoPass(center: LatLng, radiusMiles: number) {
    if (await this.ringHasLand(center, radiusMiles, BEARINGS_4)) {
      return true;
    }

    return this.ringHasLand(center, radiusMiles, BEARINGS_DIAG);
  }

  private async snapIntoOceanIfNearby(landPoint: LatLng, maxMiles: number): Promise<LatLng | null> {
    const meters = maxMiles * 1609.344;

    return (
      (await this.snapRing(landPoint, meters, BEARINGS_4)) ??
      (await this.snapRing(landPoint, meters, BEARINGS_DIAG))
    );
  }

  private async snapRing(
    landPoint: LatLng,
    meters: number,
    bearings: readonly number[],
  ): Promise<LatLng | null> {
    for (const bearing of bearings) {
      const probe = destination(landPoint, bearing, meters);
      const hinted = this.cachedOrInferredSurface(probe);
      if (hinted === "ocean") {
        return this.refineOceanEdge(landPoint, bearing, meters);
      }

      const surface = await this.classifySurface(probe);
      if (surface === "ocean") {
        return this.refineOceanEdge(landPoint, bearing, meters);
      }
    }

    return null;
  }

  private async refineOceanEdge(
    landPoint: LatLng,
    bearing: number,
    maxDistanceMeters: number,
  ): Promise<LatLng> {
    let low = 0;
    let high = maxDistanceMeters;

    for (let step = 0; step < 2; step += 1) {
      const mid = (low + high) / 2;
      const probe = destination(landPoint, bearing, mid);
      const hinted = this.cachedOrInferredSurface(probe);

      if (hinted === "ocean") {
        high = mid;
        continue;
      }
      if (hinted === "land") {
        low = mid;
        continue;
      }

      const surface = await this.classifySurface(probe);
      if (surface === "ocean") {
        high = mid;
      } else if (surface === "land") {
        low = mid;
      } else {
        high = mid;
      }
    }

    return destination(landPoint, bearing, high);
  }

  private nearestValidatedOcean(coordinate: LatLng, withinMiles: number) {
    const now = Date.now();
    this.validatedOceans = this.validatedOceans.filter((entry) => now - entry.atMs <= VALIDATED_TTL_MS);

    let best: ValidatedOcean | null = null;
    let bestMiles = Number.POSITIVE_INFINITY;

    for (const candidate of this.validatedOceans) {
      const miles = distanceMiles(
        coordinate.lat,
        coordinate.lng,
        candidate.coordinate.lat,
        candidate.coordinate.lng,
      );

      if (miles <= withinMiles && miles < bestMiles) {
        best = candidate;
        bestMiles = miles;
      }
    }

    return best?.coordinate ?? null;
  }

  private rememberValidatedOcean(coordinate: LatLng) {
    const now = Date.now();
    this.validatedOceans = this.validatedOceans.filter((entry) => now - entry.atMs <= VALIDATED_TTL_MS);
    this.validatedOceans.unshift({ coordinate, atMs: now });
    this.validatedOceans = this.validatedOceans.slice(0, VALIDATED_MAX);
  }
}
