import { useMemo } from "react";
import type { PinnedSpot } from "../domain/types";
import { useLocalJsonState } from "../lib/useLocalJsonState";

const STORAGE_KEY = "SeaThrough.Favorites.v1";

export function useFavoritesStore() {
  const [spots, setSpots] = useLocalJsonState<PinnedSpot[]>(STORAGE_KEY, []);

  return useMemo(() => {
    const addOrReplace = (spot: PinnedSpot) => {
      setSpots((current) => {
        const index = current.findIndex((item) => item.id === spot.id);

        if (index >= 0) {
          const next = [...current];
          next[index] = {
            ...spot,
            createdAt: next[index].createdAt,
            updatedAt: new Date().toISOString(),
          };
          return next;
        }

        return [spot, ...current];
      });
    };

    const remove = (id: string) => {
      setSpots((current) => current.filter((item) => item.id !== id));
    };

    const rename = (id: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) return;

      setSpots((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                name: trimmed,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    };

    return {
      spots,
      addOrReplace,
      remove,
      rename,
    };
  }, [spots, setSpots]);
}
