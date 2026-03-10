"use client";

import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Detecta dark mode via classe 'dark' e/ou prefers-color-scheme */
function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const hasClass = document.documentElement.classList.contains("dark");
      const media = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
      setIsDark(hasClass || media);
    };

    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => update();
    mql.addEventListener?.("change", onChange);

    update();
    return () => {
      mo.disconnect();
      mql.removeEventListener?.("change", onChange);
    };
  }, []);

  return isDark;
}

/**
 * Partículas leves para telas de auth.
 * - Wrapper (pai) com `relative isolate`
 * - Este canvas fica em `z-0`; card principal em `z-10`
 */
export default function AuthParticles() {
  const isDark = useIsDark();

  // Paleta e intensidade por tema.
  // 👉 Light mode com contrATE maior: cor mais escura + opacidade e tamanho maiores.
  const palette = useMemo(() => {
    if (isDark) {
      return {
        dot: "#08FFB8",          // neon no dark
        link: "#08FFB8",
        dotOpacity: 0.18,
        linkOpacity: 0.10,
        count: 45,
        speed: 0.35,
        sizeMin: 1,
        sizeMax: 2,
        linkWidth: 1,
        linkDistance: 140,
      };
    }
    // LIGHT MODE — contraste reforçado
    return {
      dot: "#065f46",            // emerald-800 (mais escuro, contrasta em fundo claro)
      link: "#047857",           // emerald-700
      dotOpacity: 0.28,          // mais evidente
      linkOpacity: 0.20,         // links mais visíveis
      count: 50,                 // um pouco mais de partículas
      speed: 0.32,
      sizeMin: 1.2,              // partículas maiores
      sizeMax: 2.6,
      linkWidth: 1.1,
      linkDistance: 150,
    };
  }, [isDark]);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <Particles
      id="auth-particles"
      init={particlesInit}
      className="absolute inset-0 z-0 pointer-events-none"
      options={{
        fullScreen: false,
        background: { color: "transparent" },
        detectRetina: true,
        fpsLimit: 60,
        particles: {
          number: { value: palette.count, density: { enable: true, area: 900 } },
          color: { value: palette.dot },
          opacity: { value: palette.dotOpacity },
          size: { value: { min: palette.sizeMin, max: palette.sizeMax } },
          links: {
            enable: true,
            color: palette.link,
            opacity: palette.linkOpacity,
            distance: palette.linkDistance,
            width: palette.linkWidth,
          },
          move: { enable: true, speed: palette.speed, outModes: { default: "out" } },
        },
        interactivity: {
          events: { resize: true },
        },
      }}
    />
  );
}
