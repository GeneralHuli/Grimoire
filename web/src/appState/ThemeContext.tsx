import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { applyTheme, resolveTheme } from "./theme";
import type { ResolvedTheme, ThemeChoice } from "./theme";

interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");
  const [prefersLight, setPrefersLight] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/general")
      .then((res) => res.json())
      .then((data: { theme?: ThemeChoice }) => {
        setChoiceState(data.theme ?? "dark");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setPrefersLight(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(choice, prefersLight);

  useEffect(() => {
    // Apply on every render where resolved changes, including before the settings fetch
    // resolves -- the un-attributed default (dark) is already correct, so this only ever
    // changes anything once a saved "light"/"system" choice loads in.
    applyTheme(resolved);
  }, [resolved]);

  function setChoice(next: ThemeChoice) {
    setChoiceState(next);
    if (loaded) {
      fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
  }

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, loaded]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
