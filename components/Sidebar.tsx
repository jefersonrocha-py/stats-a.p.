"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faGear,
  faMap,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UrlObject } from "url";
import { useUIStore } from "@store/ui";

type Role = "SUPERADMIN" | "ADMIN" | "USER";
type MeResp =
  | { ok: true; user: { id: string | number; name: string; email: string; role: Role } }
  | { ok: false; error: string };

type NavLink = {
  path: string;
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
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 ${
        active ? "bg-white/10" : ""
      } hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
      aria-current={active ? "page" : undefined}
    >
      <FontAwesomeIcon className="h-4 w-4 shrink-0" icon={icon} />
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
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 transition-[background,transform] duration-200 active:scale-[0.98] hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:bg-white/10 dark:hover:bg-white/20"
    >
      <span
        aria-hidden
        className={`absolute inset-0 rounded-xl transition-shadow duration-300 ${
          open ? "shadow-[0_0_0_8px_rgba(16,185,129,.10)]" : "shadow-none"
        }`}
      />
      <span
        className={`${barBase} ${open ? "translate-y-0 rotate-45" : "-translate-y-1.5 rotate-0"}`}
        style={{ transformOrigin: "center" }}
      />
      <span
        className={`${barBase} transition-opacity ${
          open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
        }`}
        style={{ transformOrigin: "center" }}
      />
      <span
        className={`${barBase} ${open ? "translate-y-0 -rotate-45" : "translate-y-1.5 rotate-0"}`}
        style={{ transformOrigin: "center" }}
      />
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [role, setRole] = useState<Role | null>(null);
  const canManage = role === "ADMIN" || role === "SUPERADMIN";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setSidebarOpen]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const json: MeResp = await response.json();
        if (!alive) return;
        if ("ok" in json && json.ok) setRole(json.user.role);
        else setRole(null);
      } catch {
        if (alive) setRole(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const links: NavLink[] = [
    { path: "/", href: { pathname: "/" }, icon: faMap, label: "Mapa" },
    { path: "/dashboard", href: { pathname: "/dashboard" }, icon: faChartPie, label: "Dashboard" },
    ...(canManage
      ? [{ path: "/settings", href: { pathname: "/settings" }, icon: faGear, label: "Configuracoes" }]
      : []),
  ];

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  return (
    <>
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden ${
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!sidebarOpen}
      />

      <aside
        id="app-sidebar"
        className={`fixed left-0 top-0 z-50 hidden h-screen flex-col text-white transition-all duration-300 ease-out md:flex ${
          sidebarOpen ? "md:w-64" : "md:w-16"
        }`}
        style={{
          background:
            "linear-gradient(180deg, rgba(41,107,104,1) 0%, rgba(58,60,57,1) 45%, rgba(8,255,184,0.35) 100%)",
        }}
      >
        <div className="flex min-h-[56px] items-center gap-2 border-b border-white/10 p-3">
          <Hamburger
            open={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Expandir ou recolher"
          />
          {sidebarOpen ? (
            <>
              <Image
                src="https://etheriumtech.com.br/wp-content/uploads/2024/04/LOGO-BRANCO.png"
                alt="Etheriumtech"
                width={160}
                height={40}
                className="h-6 w-auto"
              />
              <span className="ml-auto text-xs opacity-80">v1.0.0</span>
            </>
          ) : (
            <div className="h-6 w-6 rounded-lg bg-white/15" aria-hidden />
          )}
        </div>

        <nav className="space-y-1 overflow-y-auto p-2">
          {links.map((link) => (
            <NavItem
              key={link.path}
              href={link.href}
              icon={link.icon}
              label={link.label}
              open={sidebarOpen}
              active={isActive(link.path)}
            />
          ))}

          {role === "SUPERADMIN" && (
            <>
              {sidebarOpen ? (
                <div className="mt-4 px-3 text-xs uppercase tracking-wide opacity-70">Administrador</div>
              ) : (
                <div className="mt-4 px-1" />
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

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col text-white transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg, rgba(41,107,104,1) 0%, rgba(58,60,57,1) 45%, rgba(8,255,184,0.35) 100%)",
        }}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex min-h-[56px] items-center gap-2 border-b border-white/10 p-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            className="grid h-9 w-9 place-items-center rounded-lg bg-black/5 hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Fechar menu"
          >
            <span className="relative block h-[2px] w-5 rotate-45 bg-current after:absolute after:inset-0 after:-rotate-90 after:bg-current" />
          </button>
          <Image
            src="https://etheriumtech.com.br/wp-content/uploads/2024/04/LOGO-BRANCO.png"
            alt="Etheriumtech"
            width={160}
            height={40}
            className="ml-1 h-6 w-auto"
          />
          <span className="ml-auto text-xs opacity-80">v1.0.0</span>
        </div>

        <nav className="space-y-1 overflow-y-auto p-2">
          {links.map((link) => (
            <NavItem
              key={`m-${link.path}`}
              href={link.href}
              icon={link.icon}
              label={link.label}
              open={true}
              active={isActive(link.path)}
              onClick={() => setSidebarOpen(false)}
            />
          ))}

          {role === "SUPERADMIN" && (
            <>
              <div className="mt-4 px-3 text-xs uppercase tracking-wide opacity-70">Administrador</div>
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

      <div
        aria-hidden
        className={`hidden transition-[width] duration-300 md:block ${sidebarOpen ? "w-64" : "w-16"}`}
      />
    </>
  );
}
