import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";

export type Theme = "light" | "dark" | null;

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>("spark-theme", null);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  function toggleTheme() {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentlyDark = theme ? theme === "dark" : systemPrefersDark;
    setTheme(currentlyDark ? "light" : "dark");
  }

  const isDark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;

  return { isDark, toggleTheme };
}
