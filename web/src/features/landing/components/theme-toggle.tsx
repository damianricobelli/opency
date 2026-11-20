import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ThemeMode, useThemeMode } from "@/hooks/use-theme-mode";
import { m } from "@/paraglide/messages";

const NEXT_MODE = {
  light: "dark",
  dark: "auto",
  auto: "light",
} as const satisfies Record<ThemeMode, ThemeMode>;

const MODE_LABEL = {
  light: m.theme_mode_light,
  dark: m.theme_mode_dark,
  auto: m.theme_mode_auto,
} satisfies Record<ThemeMode, () => string>;

/**
 * Cycles light, dark and system. Which icon shows is CSS's call
 * (`.theme-icon` in `styles.css`), read from `<html data-theme>`: the server
 * cannot know the stored choice, so React would hydrate one icon and swap it.
 */
export function ThemeToggle() {
  const { mode, setThemeMode } = useThemeMode();
  // Hydrates with the server's default and corrects itself right after;
  // unlike the icon, nobody sees it change.
  const label = m.theme_toggle_label({ mode: MODE_LABEL[mode]() });

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setThemeMode(NEXT_MODE[mode])}
      className="grid place-items-center *:col-start-1 *:row-start-1"
    >
      <Sun aria-hidden data-mode="light" className="theme-icon size-4" />
      <Moon aria-hidden data-mode="dark" className="theme-icon size-4" />
      <SunMoon aria-hidden data-mode="auto" className="theme-icon size-4" />
    </Button>
  );
}
