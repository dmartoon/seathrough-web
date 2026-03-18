import type { PinnedSpot } from "../../types/map";

type PinDetailsPanelProps = {
  pin: PinnedSpot | null;
  onUseMyLocation: () => void;
  onClearPin: () => void;
  locationError: string | null;
};

function formatCoord(value: number) {
  return value.toFixed(6);
}

export function PinDetailsPanel({
  pin,
  onUseMyLocation,
  onClearPin,
  locationError,
}: PinDetailsPanelProps) {
  return (
    <aside className="details-panel">
      <div className="details-card">
        <p className="eyebrow">Selected pin</p>
        <h2>{pin ? pin.label : "No pin selected"}</h2>

        {pin ? (
          <>
            <div className="coord-grid">
              <div>
                <span className="coord-label">Latitude</span>
                <strong>{formatCoord(pin.position.lat)}</strong>
              </div>
              <div>
                <span className="coord-label">Longitude</span>
                <strong>{formatCoord(pin.position.lng)}</strong>
              </div>
            </div>

            <p className="helper-text">
              Long press anywhere on the map to place a pin, then drag it to refine
              the location.
            </p>
          </>
        ) : (
          <p className="helper-text">
            Long press on the map to place your first pin.
          </p>
        )}

        <div className="details-actions">
          <button className="primary-button" onClick={onUseMyLocation}>
            Use my location
          </button>
          <button
            className="secondary-button"
            onClick={onClearPin}
            disabled={!pin}
          >
            Clear pin
          </button>
        </div>

        {locationError ? <p className="error-text">{locationError}</p> : null}
      </div>

      <div className="details-card muted-card">
        <p className="eyebrow">Next</p>
        <h3>Forecast from this pin</h3>
        <p className="helper-text">
          Once the map flow is stable, this exact selected pin will drive the forecast
          request.
        </p>
      </div>
    </aside>
  );
}