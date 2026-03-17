export type Region =
  | "southernCalifornia"
  | "northernCalifornia"
  | "hawaii"
  | "florida"
  | "gulfCoast"
  | "pacificNorthwest"
  | "eastCoast";

export interface DiveLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  buoyId: string;
  tideStation: string;
  shoreDirection: number;
  region: Region;
}

export interface PinnedSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  buoyId: string;
  tideStation: string;
  shoreDirection: number;
  region: Region;
  source: "supported" | "custom";
  createdAt: string;
  updatedAt: string;
}

export interface PlannedDive {
  id: string;
  spotId: string;
  spotName: string;
  latitude: number;
  longitude: number;
  buoyId: string;
  tideStation: string;
  shoreDirection: number;
  region: Region;
  slotTime: string;
  createdAt: string;
}

export interface HourlyDiveForecast {
  time: string;
  waveHeightFt?: number;
  wavePeriodSec?: number;
  waveDirectionDeg?: number;
  waterTempF?: number;
  windSpeedKt?: number;
  windDirectionDeg?: number;
  tideHeightFt?: number;
  predictedClarityFt?: number;
  predictedClarityMinFt?: number;
  predictedClarityMaxFt?: number;
  predictedClarityLabel?: string;
}
