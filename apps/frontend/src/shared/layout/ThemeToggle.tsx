import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-sm text-sidebar-accent-foreground transition-colors hover:bg-primary/10"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="font-medium">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
};

export default ThemeToggle;
