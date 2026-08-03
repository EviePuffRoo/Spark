import { useTheme } from "../useTheme";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className="btn-secondary theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
