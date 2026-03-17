import type { PlannedDive } from "../../domain/types";

type PlannedTabProps = {
  dives: PlannedDive[];
  onRemove: (id: string) => void;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PlannedTab({ dives, onRemove }: PlannedTabProps) {
  if (dives.length === 0) {
    return (
      <section className="panel">
        <h2>Planned Dives</h2>
        <p className="muted">
          No planned dives yet. Add a test slot from the Map tab to verify the
          local-only storage flow.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Planned Dives</h2>
          <p className="muted">Past slots are auto-pruned every minute.</p>
        </div>
        <span className="badge">{dives.length}</span>
      </div>

      <div className="stack">
        {dives.map((dive) => (
          <article className="card" key={dive.id}>
            <div className="card-row">
              <div>
                <h3>{dive.spotName}</h3>
                <p className="muted small">{formatDateTime(dive.slotTime)}</p>
                <p className="muted small">
                  Buoy {dive.buoyId} · Tide {dive.tideStation}
                </p>
              </div>

              <button className="ghost-button" onClick={() => onRemove(dive.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
