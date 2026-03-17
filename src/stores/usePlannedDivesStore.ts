import { useEffect, useMemo } from "react";
import type { PlannedDive } from "../domain/types";
import { useLocalJsonState } from "../lib/useLocalJsonState";

const STORAGE_KEY = "st_planned_dives_v1";

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function prunePastDives(dives: PlannedDive[], reference = new Date()) {
  const cutoff = startOfHour(reference).getTime();

  return dives
    .filter((dive) => new Date(dive.slotTime).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(a.slotTime).getTime() - new Date(b.slotTime).getTime(),
    );
}

export function usePlannedDivesStore() {
  const [dives, setDives] = useLocalJsonState<PlannedDive[]>(STORAGE_KEY, []);

  useEffect(() => {
    setDives((current) => prunePastDives(current));
  }, [setDives]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDives((current) => prunePastDives(current));
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [setDives]);

  return useMemo(() => {
    const add = (dive: PlannedDive) => {
      setDives((current) => {
        const next = prunePastDives(current);
        const duplicate = next.some(
          (existing) =>
            existing.spotId === dive.spotId &&
            Math.abs(
              new Date(existing.slotTime).getTime() -
                new Date(dive.slotTime).getTime(),
            ) < 60_000,
        );

        if (duplicate) {
          return next;
        }

        return prunePastDives([...next, dive]);
      });
    };

    const remove = (id: string) => {
      setDives((current) => current.filter((item) => item.id !== id));
    };

    return {
      dives,
      add,
      remove,
    };
  }, [dives, setDives]);
}
