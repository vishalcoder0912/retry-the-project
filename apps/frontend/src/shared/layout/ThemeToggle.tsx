import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-slate-900"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className="flex items-center gap-2">
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {isDark ? "Dark" : "Light"}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          isDark ? "bg-violet-600" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition ${
            isDark ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
};

export default ThemeToggle;
