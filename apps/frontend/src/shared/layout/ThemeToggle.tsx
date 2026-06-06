import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
<<<<<<< HEAD
      className="flex w-full items-center justify-between rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 shadow-sm"
=======
      className="flex w-full items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-slate-900"
>>>>>>> origin/main
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className="flex items-center gap-2">
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {isDark ? "Dark" : "Light"}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
<<<<<<< HEAD
          isDark ? "bg-gray-900" : "bg-gray-300"
=======
          isDark ? "bg-violet-600" : "bg-slate-600"
>>>>>>> origin/main
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition ${
<<<<<<< HEAD
            isDark ? "left-[22px]" : "left-0.5 shadow-sm"
=======
            isDark ? "left-[22px]" : "left-0.5"
>>>>>>> origin/main
          }`}
        />
      </span>
    </button>
  );
};

export default ThemeToggle;
