import { useEffect, useState } from "react";

type ThemeChoice = "light" | "dark" | "system";

const choices: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function getInitialChoice(): ThemeChoice {
  const choice = document.documentElement.dataset.themeChoice;
  return choice === "light" || choice === "dark" || choice === "system"
    ? choice
    : "system";
}

function resolveTheme(choice: ThemeChoice, prefersLight: boolean) {
  return choice === "system" ? (prefersLight ? "light" : "dark") : choice;
}

export default function ThemeSwitcher() {
  const [choice, setChoice] = useState<ThemeChoice>(getInitialChoice);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(choice, media.matches);
      document.documentElement.dataset.themeChoice = choice;
    };
    apply();
    localStorage.setItem("gitatlas-theme", choice);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [choice]);

  return (
    <div className="theme-switcher" role="group" aria-label="Color theme">
      {choices.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          onClick={() => setChoice(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
