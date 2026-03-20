import { useEffect, useState } from "react";
import type { PinnedSpot } from "../../domain/types";
import {
  fetchSpotForecast,
  readCachedForecast,
  type ForecastApiResponse,
} from "./forecastApi";

type UseSpotForecastResult = {
  data: ForecastApiResponse | null;
  error: string | null;
  isLoading: boolean;
};

export function useSpotForecast(spot: PinnedSpot | null): UseSpotForecastResult {
  const [data, setData] = useState<ForecastApiResponse | null>(() =>
    spot ? readCachedForecast(spot) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => (spot ? !readCachedForecast(spot) : false));

  useEffect(() => {
    if (!spot) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const cached = readCachedForecast(spot);
    if (cached) {
      setData(cached);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchSpotForecast(spot)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
        setIsLoading(false);
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Unable to load forecast.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spot]);

  return { data, error, isLoading };
}
