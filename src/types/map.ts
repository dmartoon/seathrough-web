export type LatLng = {
  lat: number;
  lng: number;
};

export type MapViewState = {
  center: LatLng;
  zoom: number;
};

export type PinnedSpot = {
  id: string;
  position: LatLng;
  label: string;
  createdAt: number;
  updatedAt: number;
};