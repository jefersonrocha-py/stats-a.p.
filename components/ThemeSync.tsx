"use client";

import { useEffect } from "react";
import { initThemeFromStorage, watchSystemTheme } from "@store/theme";

export default function ThemeSync() {
  useEffect(() => {
    initThemeFromStorage();
    return watchSystemTheme();
  }, []);

  return null;
}
