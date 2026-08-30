import { useEffect } from "react";
import { useVoyage } from "@/lib/store";

export function HydrateStore() {
  useEffect(() => {
    const done = () => useVoyage.getState().setHasHydrated(true);
    const unsub = useVoyage.persist.onFinishHydration(done);
    void useVoyage.persist.rehydrate();
    if (useVoyage.persist.hasHydrated()) done();
    const fallback = setTimeout(done, 1200);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, []);
  return null;
}
