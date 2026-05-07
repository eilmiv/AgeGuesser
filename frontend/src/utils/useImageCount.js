/**
 * Custom hook that fetches the available image count from the backend
 * whenever the filter parameters change.
 *
 * The fetch is debounced by `debounceMs` milliseconds (default 300) so that
 * rapid user input in ConfigForm doesn't hammer the server.
 *
 * Returns: { count: number | null, loading: boolean, error: string | null }
 *   count  – null while the first fetch is in flight
 *   loading – true while a fetch is pending / in-flight
 *   error  – error message if the last fetch failed, otherwise null
 */

import { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function useImageCount(config, { debounceMs = 300 } = {}) {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve default and stringify all filter params for the effect dep array.
  // Using JSON.stringify avoids object-identity churn on every render.
  const depsKey = JSON.stringify({
    minAge: config.minAge,
    maxAge: config.maxAge,
    genders: [...config.genders].sort(),
    races: [...config.races].sort(),
    resolutions: [...(config.resolutions ?? ["low", "medium", "high"])].sort(),
    datasets: [...config.datasets].sort(),
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      const parsed = JSON.parse(depsKey);
      const params = new URLSearchParams({
        min_age: parsed.minAge,
        max_age: parsed.maxAge,
        genders: parsed.genders.join(","),
        races: parsed.races.join(","),
        resolutions: parsed.resolutions.join(","),
        datasets: parsed.datasets.join(","),
      });

      try {
        const res = await fetch(`${API_BASE}/api/count?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setCount(data.count);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [depsKey, debounceMs]);

  return { count, loading, error };
}
