"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

export type ThemeName =
  | "purple"
  | "ocean"
  | "sunset"
  | "forest"
  | "midnight"
  | "cherry";

type Appearance =
  | "dark"
  | "light"
  | "system";

interface ThemeContextType {

  theme: ThemeName;

  setTheme: (
    theme: ThemeName
  ) => void;

  appearance: Appearance;

  setAppearance: (
    mode: Appearance
  ) => void;

  themeName: string;

}

const ThemeContext =
  createContext<
    ThemeContextType | undefined
  >(undefined);

export const themeLabels = {

  purple: "Purple Passion",
  ocean: "Ocean Breeze",
  sunset: "Sunset Glow",
  forest: "Forest Mist",
  midnight: "Midnight Blue",
  cherry: "Cherry Blossom",

};

const applyAppearance = (
  mode: Appearance
) => {

  const html =
    document.documentElement;

  if (mode === "system") {

    const isDark =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    html.setAttribute(
      "data-mode",
      isDark
        ? "dark"
        : "light"
    );

    return;

  }

  html.setAttribute(
    "data-mode",
    mode
  );

};

export function ThemeProvider({
  children
}: {
  children: React.ReactNode;
}) {

  const [theme, setThemeState] =
    useState<ThemeName>(() => {
      if (typeof window === "undefined") return "purple";
      const savedTheme = localStorage.getItem("app-theme") as ThemeName | null;
      return savedTheme && themeLabels[savedTheme] ? savedTheme : "purple";
    });

  const [appearance, setAppearanceState] =
    useState<Appearance>(() => {
      if (typeof window === "undefined") return "dark";
      const savedAppearance = localStorage.getItem("app-appearance") as Appearance | null;
      return savedAppearance || "dark";
    });

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    applyAppearance(
      appearance
    );

  }, [appearance, theme]);

  const setTheme = (
    newTheme: ThemeName
  ) => {

    setThemeState(newTheme);

    localStorage.setItem(
      "app-theme",
      newTheme
    );

    document.documentElement.setAttribute(
      "data-theme",
      newTheme
    );

  };

  const setAppearance = (
    mode: Appearance
  ) => {

    setAppearanceState(mode);

    localStorage.setItem(
      "app-appearance",
      mode
    );

    applyAppearance(mode);

  };

  return (

    <ThemeContext.Provider
      value={{

        theme,
        setTheme,

        appearance,
        setAppearance,

        themeName:
          themeLabels[theme],

      }}
    >

      {children}

    </ThemeContext.Provider>

  );

}

export function useTheme() {

  const context =
    useContext(ThemeContext);

  if (!context) {

    throw new Error(
      "useTheme must be used within ThemeProvider"
    );

  }

  return context;

}
