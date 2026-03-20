import type { PlannedDive } from "../../domain/types";
import { buildCurrentConditions } from "../forecast/placeholderForecast";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type PlannedTabProps = {
  dives: PlannedDive[];
  onOpen: (dive: PlannedDive) => void;
  onRemove: (dive: PlannedDive) => void;
};

export function PlannedTab({ dives, onOpen, onRemove }: PlannedTabProps) {
  if (dives.length === 0) {
    return (
      <section className="list-stage">
        <div className="section-empty-card">
          <h2>Planned dives</h2>
          <p className="helper-text">Use the forecast screen to save future slots here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="list-stage">
      <div className="section-title-row">
        <div>
          <h2>Planned dives</h2>
        </div>
      </div>

      <div className="spot-list">
        {dives.map((dive) => {
          const conditions = buildCurrentConditions({
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
          });

          return (
            <article key={dive.id} className="list-spot-card">
              <button type="button" className="list-spot-main" onClick={() => onOpen(dive)}>
                <div className="list-spot-copy">
                  <h3>{dive.spotName}</h3>
                  <p className="list-spot-date">{formatDateTime(dive.slotTime)}</p>
                  <p>{conditions.buoyLabel}</p>
                </div>

                <div className="list-spot-side">
                  <span className="list-spot-side-label">Current water clarity</span>
                  <strong>{conditions.clarityRange}</strong>
                </div>
              </button>

              <div className="list-spot-actions">
                <button type="button" className="secondary-button compact-button" onClick={() => onOpen(dive)}>
                  View forecast
                </button>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() => onRemove(dive)}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
