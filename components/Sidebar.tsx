"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@store/ui";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMap,
  faChartPie,
  faGear,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import type { UrlObject } from "url";

// ==== Tipos ====
type Role = "SUPERADMIN" | "ADMIN" | "USER";
type MeResp =
  | { ok: true; user: { id: string | number; name: string; email: string; role: Role } }
  | { ok: false; error: string };

// href SEMPRE como UrlObject para agradar typedRoutes
type NavLink = {
  /** string para cálculo de ativo */
  path: string;
  /** href para <Link> */
  href: UrlObject;
  icon: any;
  label: string;
};

type ItemProps = {
  href: UrlObject;
  icon: any;
  label: string;
  open: boolean;
  active: boolean;
  onClick?: () => void;
};

function NavItem({ href, icon, label, open, active, onClick }: ItemProps) {
  return (
    <Link
      href={href}
      title={label}
      onClick={onClick}
      prefetch={false}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg
        hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
        ${active ? "bg-white/10" : ""}
      `}
      aria-current={active ? "page" : undefined}
    >
      <FontAwesomeIcon className="w-4 h-4 shrink-0" icon={icon} />
      {open ? <span className="text-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </Link>
  );
}

function Hamburger({
  open,
  onClick,
  title,
}: {
  open: boolean;
  onClick: () => void;
  title?: string;
}) {
  const barBase =
    "absolute block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:duration-0";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title || "Menu"}
      aria-expanded={open}
      aria-controls="app-sidebar"
      aria-pressed={open}
      title={title || "Menu"}
      className={`
        relative inline-flex h-10 w-10 items-center justify-center rounded-xl
        bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
        transition-[background,transform] duration-200 active:scale-[0.98]
      `}
    >
      {/* brilho sutil quando aberto */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-xl transition-shadow duration-300 ${
          open ? "shadow-[0_0_0_8px_rgba(16,185,129,.10)]" : "shadow-none"
        }`}
      />

      {/* barra superior */}
      <span
        className={`${barBase} ${open ? "translate-y-0 rotate-45" : "-translate-y-1.5 rotate-0"}`}
        style={{ transformOrigin: "center" }}
      />

      {/* barra do meio */}
      <span
        className={`${barBase} transition-opacity ${
          open ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
        }`}
        style={{ transformOrigin: "center" }}
      />

      {/* barra inferior */}
      <span
        className={`${barBase} ${open ? "translate-y-0 -rotate-45" : "translate-y-1.5 rotate-0"}`}
        style={{ transformOrigin: "center" }}
      />

      {/* glow leve ao passar o mouse */}
      <span
        aria-hidden
        className="pointer-events-none absolute h-10 w-10 rounded-xl ring-0 hover:ring-1 hover:ring-white/10 transition"
      />
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [role, setRole] = useState<Role | null>(null);

  // ESC fecha off-canvas (mobile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setSidebarOpen]);

  // Descobrir role via /api/me
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const j: MeResp = await r.json();
        if (!alive) return;
        if ("ok" in j && j.ok) setRole(j.user.role);
        else setRole(null);
      } catch {
        if (alive) setRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Lista de links (sempre UrlObject)
  const links: NavLink[] = [
    { path: "/",          href: { pathname: "/" },          icon: faMap,      label: "Mapa" },
    { path: "/dashboard", href: { pathname: "/dashboard" }, icon: faChartPie, label: "Dashboard" },
    { path: "/settings",  href: { pathname: "/settings" },  icon: faGear,     label: "Configurações" },
  ];

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <>
      {/* Backdrop mobile */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden transition-opacity
          ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        aria-hidden={!sidebarOpen}
      />

      {/* DESKTOP */}
      <aside
        id="app-sidebar"
        className={`
          fixed left-0 top-0 z-50 h-screen text-white
          transition-all duration-300 ease-out
          hidden md:flex flex-col
          ${sidebarOpen ? "md:w-64" : "md:w-16"}
        `}
        style={{
          background:
            "linear-gradient(180deg, rgba(41,107,104,1) 0%, rgba(58,60,57,1) 45%, rgba(8,255,184,0.35) 100%)",
        }}
      >
        {/* Cabeçalho com hambúrguer (desktop) */}
        <div className="p-3 flex items-center gap-2 border-b border-white/10 min-h-[56px]">
          <Hamburger
            open={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Expandir/Retrair"
          />
          {sidebarOpen ? (
            <>
              <img
                src="https://etheriumtech.com.br/wp-content/uploads/2024/04/LOGO-BRANCO.png"
                alt="Etheriumtech"
                className="h-6"
              />
              <span className="ml-auto text-xs opacity-80">v1.0.0</span>
            </>
          ) : (
            <div className="h-6 w-6 rounded-lg bg-white/15" aria-hidden />
          )}
        </div>

        {/* Navegação principal */}
        <nav className="p-2 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavItem
              key={l.path}
              href={l.href}
              icon={l.icon}
              label={l.label}
              open={sidebarOpen}
              active={isActive(l.path)}
            />
          ))}

          {/* Seção Administrador (somente SUPERADMIN) */}
          {role === "SUPERADMIN" && (
            <>
              {sidebarOpen ? (
                <div className="px-3 mt-4 text-xs uppercase tracking-wide opacity-70">
                  Administrador
                </div>
              ) : (
                <div className="px-1 mt-4" />
              )}
              <NavItem
                href={{ pathname: "/admin" }}
                icon={faShieldHalved}
                label="Painel"
                open={sidebarOpen}
                active={isActive("/admin")}
              />
            </>
          )}
        </nav>
      </aside>

      {/* MOBILE (off-canvas) */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen w-72 text-white
          flex flex-col md:hidden transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background:
            "linear-gradient(180deg, rgba(41,107,104,1) 0%, rgba(58,60,57,1) 45%, rgba(8,255,184,0.35) 100%)",
        }}
        aria-hidden={!sidebarOpen}
      >
        <div className="p-3 flex items-center gap-2 border-b border-white/10 min-h-[56px]">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            className="h-9 w-9 grid place-items-center rounded-lg bg-black/5 hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Fechar menu"
          >
            <span className="relative block h-[2px] w-5 bg-current rotate-45 after:absolute after:inset-0 after:-rotate-90 after:bg-current" />
          </button>
          <img
            src="https://etheriumtech.com.br/wp-content/uploads/2024/04/LOGO-BRANCO.png"
            alt="Etheriumtech"
            className="h-6 ml-1"
          />
          <span className="ml-auto text-xs opacity-80">v1.0.0</span>
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavItem
              key={`m-${l.path}`}
              href={l.href}
              icon={l.icon}
              label={l.label}
              open={true}
              active={isActive(l.path)}
              onClick={() => setSidebarOpen(false)}
            />
          ))}

          {role === "SUPERADMIN" && (
            <>
              <div className="px-3 mt-4 text-xs uppercase tracking-wide opacity-70">Administrador</div>
              <NavItem
                href={{ pathname: "/admin" }}
                icon={faShieldHalved}
                label="Painel"
                open={true}
                active={isActive("/admin")}
                onClick={() => setSidebarOpen(false)}
              />
            </>
          )}
        </nav>
      </aside>

      {/* Empurrador do conteúdo no desktop */}
      <div
        aria-hidden
        className={`hidden md:block transition-[width] duration-300 ${sidebarOpen ? "w-64" : "w-16"}`}
      />
    </>
  );
}
