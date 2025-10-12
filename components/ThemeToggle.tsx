// components/ThemeToggle.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initThemeFromStorage, useThemeStore } from "@store/theme";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

/**
 * Melhorias:
 * - Evita depender de types não-exportados: define ThemeMode local ("light" | "dark" | "system")
 * - Hidratação estável (sem flicker entre SSR/CSR)
 * - A11y: fecha com ESC e clique fora; navegação por setas; aria-* correto
 * - Long-press no mobile abre o menu de opções
 */

type ThemeMode = "light" | "dark" | "system";
const OPTIONS: ThemeMode[] = ["light", "dark", "system"];

export default function ThemeToggle() {
  const { theme, toggle, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefersDark, setPrefersDark] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);

  // Inicializa tema e observa prefers-color-scheme
  useEffect(() => {
    initThemeFromStorage();
    setMounted(true);

    if (typeof window !== "undefined" && "matchMedia" in window) {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => setPrefersDark(Boolean(mql.matches));
      apply();
      mql.addEventListener?.("change", apply);
      return () => mql.removeEventListener?.("change", apply);
    }
  }, []);

  // Fecha ao clicar fora / ESC
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current || !btnRef.current) return;
      if (menuRef.current.contains(t) || btnRef.current.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // SSR-safe: só decide ícone/label após montar
  const isLight = useMemo(() => {
    if (!mounted) return true;
    if (theme === "light") return true;
    if (theme === "dark") return false;
    return !prefersDark; // system
  }, [mounted, theme, prefersDark]);

  function select(t: ThemeMode) {
    setTheme(t as any); // compat com store existente
    setOpen(false);
  }

  // Long-press (mobile) para abrir menu
  function onPointerDown() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => setOpen(true), 450);
  }
  function onPointerUpLeave() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  // Acessibilidade: seta para baixo abre menu e foca 1º item
  function onButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      queueMicrotask(() => {
        const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
        first?.focus();
      });
    }
  }

  const menuId = "theme-menu";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUpLeave}
        onPointerLeave={onPointerUpLeave}
        className="rounded px-3 py-2 bg-brand1 text-white hover:opacity-90 flex items-center gap-2"
        title="Clique: alternar Claro/Escuro • Botão direito/long-press: opções"
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={isLight ? faSun : faMoon} />
        <span className="hidden md:inline">{isLight ? "Light" : "Dark"}</span>
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Tema"
          className="absolute right-0 mt-2 w-44 rounded-lg bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 shadow-lg overflow-hidden z-[500]"
        >
          {OPTIONS.map((opt) => {
            const isActive = theme === opt;
            return (
              <button
                key={opt}
                onClick={() => select(opt)}
                role="menuitem"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                  isActive ? "font-medium" : ""
                }`}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.focus();
                  } else if (e.key === "ArrowUp") {
                    (e.currentTarget.previousElementSibling as HTMLButtonElement | null)?.focus();
                  } else if (e.key === "Escape") {
                    setOpen(false);
                    btnRef.current?.focus();
                  }
                }}
              >
                {opt === "light" ? "Claro" : opt === "dark" ? "Escuro" : "Sistema"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
