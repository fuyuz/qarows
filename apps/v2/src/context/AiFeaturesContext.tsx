import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiJson } from "@/lib/api/client";

interface HealthResponse {
  ok: boolean;
  aiEnabled?: boolean;
  aiModel?: string;
  aiModelFallback?: string;
}

interface AiFeaturesContextValue {
  loaded: boolean;
  aiEnabled: boolean;
  aiModel: string | null;
  aiModelFallback: string | null;
}

const AiFeaturesContext = createContext<AiFeaturesContextValue>({
  loaded: false,
  aiEnabled: false,
  aiModel: null,
  aiModelFallback: null,
});

export function AiFeaturesProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiJson<HealthResponse>("/api/health")
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth({ ok: false, aiEnabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AiFeaturesContextValue>(
    () => ({
      loaded: health != null,
      aiEnabled: health?.aiEnabled === true,
      aiModel: health?.aiModel ?? null,
      aiModelFallback: health?.aiModelFallback ?? null,
    }),
    [health],
  );

  return <AiFeaturesContext.Provider value={value}>{children}</AiFeaturesContext.Provider>;
}

export function useAiFeatures(): AiFeaturesContextValue {
  return useContext(AiFeaturesContext);
}
