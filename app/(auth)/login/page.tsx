"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faTowerBroadcast, faUser } from "@fortawesome/free-solid-svg-icons";
import AuthParticles from "@components/AuthParticles";
import { api } from "@services/api";

const ETHERIUM_LOGO = {
  src: "/logo_etherium.png",
  alt: "Etheriumtech",
  width: 346,
  height: 369,
} as const;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/");
    } catch (err: any) {
      const message = String(err?.message || "");
      if (message.includes("INVALID_CREDENTIALS")) setError("Credenciais invalidas.");
      else if (message.includes("ORIGIN_MISMATCH") || message.includes("ORIGIN_REQUIRED")) {
        setError("Falha de origem da requisicao. Recarregue a pagina e tente novamente.");
      } else if (message.includes("CSRF_INVALID")) {
        setError("Sessao de seguranca invalida. Recarregue a pagina e tente novamente.");
      }
      else setError("Nao foi possivel entrar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10">
        <AuthParticles />
      </div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/35 via-emerald-600/25 to-transparent blur-3xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2 }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-16 -z-10 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-300/25 via-emerald-500/20 to-transparent blur-3xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.1 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl shadow-[0_10px_45px_-18px_rgba(16,185,129,0.5)] ring-1 ring-white/10"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
      >
        <div className="relative bg-gradient-to-b from-emerald-300/90 via-emerald-400/80 to-emerald-500/60 px-6 py-7 backdrop-blur sm:px-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-[28px] border border-black/10 bg-[#F9F9F9] px-4 py-3 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]">
              <Image
                src={ETHERIUM_LOGO.src}
                alt={ETHERIUM_LOGO.alt}
                width={ETHERIUM_LOGO.width}
                height={ETHERIUM_LOGO.height}
                className="h-16 w-auto sm:h-20"
                priority
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/10 px-3 py-1.5 text-sm font-medium text-black/75">
              <FontAwesomeIcon icon={faTowerBroadcast} className="h-4 w-4" />
              Monitoramento de APs
            </div>
          </div>
        </div>

        <div className="glass rounded-b-3xl px-6 py-8 sm:px-10">
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="sr-only">Email</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-80">
                  <FontAwesomeIcon icon={faUser} className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Username / Email"
                  className="h-11 w-full rounded-xl border border-black/10 bg-white/80 pl-9 pr-3 outline-none focus:ring-2 focus:ring-emerald-400 dark:border-white/10 dark:bg-white/10"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="sr-only">Senha</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-80">
                  <FontAwesomeIcon icon={faLock} className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  className="h-11 w-full rounded-xl border border-black/10 bg-white/80 pl-9 pr-3 outline-none focus:ring-2 focus:ring-emerald-400 dark:border-white/10 dark:bg-white/10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </label>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-shine h-11 w-full rounded-xl bg-white text-neutral-900 shadow-soft transition hover:bg-white/95 active:scale-[.995] disabled:opacity-60"
            >
              {busy ? "Entrando..." : "LOGIN"}
            </button>

            <div className="text-center text-xs opacity-80">
              Solicite o acesso ou a redefinicao de senha com um administrador.
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
