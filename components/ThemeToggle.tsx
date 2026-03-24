"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun, faDesktop } from "@fortawesome/free-solid-svg-icons";
import { useThemeStore, type ThemeMode } from "@store/theme";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof faSun }[] = [
  { value: "light", label: "Claro", icon: faSun },
  { value: "dark", label: "Escuro", icon: faMoon },
  { value: "system", label: "Sistema", icon: faDesktop },
];

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, toggle } = useThemeStore();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const icon = resolvedTheme === "light" ? faSun : faMoon;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onContextMenu={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
        className="surface-soft-hover inline-flex items-center gap-2 rounded-lg px-3 py-2"
        title="Clique para alternar o tema. Botao direito abre as opcoes."
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        <span className="hidden text-sm md:inline">
          {resolvedTheme === "light" ? "Light" : "Dark"}
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className="surface-overlay absolute right-0 z-[500] mt-2 w-44 overflow-hidden rounded-xl"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              onClick={() => {
                setTheme(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                theme === option.value ? "bg-emerald-500/16" : "hover:bg-white/10 dark:hover:bg-white/10"
              }`}
            >
              <FontAwesomeIcon icon={option.icon} className="h-4 w-4" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
