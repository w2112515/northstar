"use client";

/** One data layer for every live surface. SWR keys are API paths, so the
 *  ribbon and the pages share a single in-flight request + cache per endpoint
 *  instead of eight hand-rolled setIntervals racing each other. */

import { useEffect } from "react";
import useSWR, { mutate, type SWRConfiguration } from "swr";
import { apiGet } from "@/lib/api";

const fetcher = <T,>(path: string) => apiGet<T>(path);

/** Revalidate every subscribed key - call after any state-changing action. */
export const refreshAll = () => mutate(() => true, undefined, { revalidate: true });

/** Poll an API path. Pass null to pause. Components sharing a path share the
 *  cache and the request - a second subscriber costs zero extra HTTP. */
export function useApi<T>(path: string | null, refreshMs = 0, extra?: SWRConfiguration<T>) {
  return useSWR<T>(path, fetcher, {
    refreshInterval: refreshMs,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 2000,
    ...extra,
  });
}

/** Any `northstar:refresh` event revalidates the whole cache. Installed once
 *  in the ribbon, which is mounted on every page. */
export function useRefreshBridge() {
  useEffect(() => {
    const h = () => void refreshAll();
    window.addEventListener("northstar:refresh", h);
    return () => window.removeEventListener("northstar:refresh", h);
  }, []);
}
