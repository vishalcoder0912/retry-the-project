import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center justify-between border border-sidebar-border px-4 py-3 text-sm uppercase tracking-[0.08em] text-sidebar-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
};

export default ThemeToggle;
