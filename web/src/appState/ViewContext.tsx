import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type View = { kind: "home" } | { kind: "spell"; name: string };

interface ViewContextValue {
  view: View;
  goHome: () => void;
  openSpell: (name: string) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

function parseHash(hash: string): View {
  const match = /^#\/spell\/([^/]+)$/.exec(hash);
  if (match) return { kind: "spell", name: decodeURIComponent(match[1]) };
  return { kind: "home" };
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(() => parseHash(location.hash));

  useEffect(() => {
    const onHashChange = () => setView(parseHash(location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const value = useMemo(
    () => ({
      view,
      goHome: () => {
        location.hash = "/";
      },
      openSpell: (name: string) => {
        location.hash = `/spell/${encodeURIComponent(name)}`;
      },
    }),
    [view]
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used within a ViewProvider");
  return ctx;
}
