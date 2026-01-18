import { useTheme as useNextTheme } from "next-themes";

/**
 * Hook for toggling between light and dark theme.
 * Handles the "system" theme by resolving to the actual system preference.
 */
export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme();
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return { theme: resolvedTheme as "light" | "dark", setTheme, toggleTheme };
}
