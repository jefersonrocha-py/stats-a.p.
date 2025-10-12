"use client";

import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";

/**
 * Footer (layout do exemplo) + efeitos modernos:
 * - Esquerda: título + descrição + CTA
 * - Direita: contato (Email/Endereço) + sociais
 * - Linha inferior: Powered by em lista com ícone do LinkedIn + Copyright
 * - Efeitos:
 *   • CTA com brilho suave (before) + leve lift/translate
 *   • Links com sublinhado animado (after)
 *   • Ícones sociais e itens do Powered by com hover translate/shine
 *   • Glow radial decorativo (sem pesar)
 * - Acessibilidade: focus-visible, alvos 40–44px, sem dependências extras
 */

// ====== DADOS ======
const CONTACT = {
  email: "infraestrutura@etheriumtech.com.br",
  address:
    "Rua Bonnard, nº 980 , Bloco 10 - Green Valley Office Park - Barueri/SP",
};

const SOCIAL = {
  site: "https://etheriumtech.com.br",
  instagram: "#",
  linkedin: "#",
};

type Member = { name: string; role: string; linkedin?: string };
const TEAM: Member[] = [
  { name: "Jeferson Oliveira", role: "Network Engineer", linkedin: "#" },
  { name: "Marcos Ribeiro", role: "Software Engineer", linkedin: "#" },
  { name: "Mickael Oliveira", role: "DevOps/SRE", linkedin: "#" },
];

// Texto do produto (mantido)
const PRODUCT_TITLE = "Stats A.P";
const PRODUCT_COPY =
  "O Stats A.P é uma aplicação voltada ao projeto de Wi-Fi Público de Mogi Mirim. " +
  "Sincroniza com a Cloud GDMS (Grandstream) para coletar o status dos pontos de acesso " +
  "(online/offline) e suas coordenadas de latitude/longitude, georreferenciando-os em " +
  "um mapa interativo centralizado no município. Desenvolvido em Node.js e Next.js, " +
  "integra-se de forma segura via API ao GDMS para fornecer visibilidade operacional, " +
  "telemetria e suporte à tomada de decisão.";

export default function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer
      role="contentinfo"
      className="relative w-full mt-10 rounded-2xl overflow-hidden
                 bg-white/60 dark:bg-neutral-900/70
                 backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10"
    >
      {/* linha superior */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

      {/* glow decorativo suave */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[1px] rounded-[18px]
                   bg-[radial-gradient(140px_80px_at_10%_-20%,rgba(16,185,129,0.12),transparent),
                       radial-gradient(140px_80px_at_90%_120%,rgba(59,130,246,0.10),transparent)]"
      />

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* GRID principal — esquerda (texto+CTA) / direita (contato) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
            {/* ESQUERDA */}
            <div className="md:col-span-7">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {PRODUCT_TITLE}
              </h2>

              <p className="mt-3 text-sm md:text-base opacity-90 leading-relaxed max-w-prose [text-wrap:balance]">
                {PRODUCT_COPY}
              </p>

              {/* CTA com brilho + micro-lift */}
              <div className="mt-5">
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="group relative inline-flex items-center justify-center rounded-lg
                             border border-black/15 dark:border-white/15
                             bg-black/5 dark:bg-white/10
                             hover:bg-black/10 dark:hover:bg-white/20
                             transition-all duration-300 ease-out
                             px-4 py-2 text-sm font-medium
                             shadow-[0_1px_0_0_rgba(0,0,0,0.04)]
                             hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.25)]
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-black/30 dark:focus-visible:ring-white/30
                             translate-y-0 group-hover:-translate-y-0.5"
                >
                  {/* brilho que aparece ao hover */}
                  <span className="pointer-events-none absolute inset-0 rounded-lg opacity-0
                                   transition-opacity duration-300 ease-out
                                   bg-gradient-to-r from-white/0 via-white/10 to-white/0
                                   group-hover:opacity-100" />
                  <span className="relative">Fale conosco por e-mail</span>
                </a>
              </div>
            </div>

            {/* DIREITA */}
            <div className="md:col-span-5">
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="opacity-70">Email</dt>
                <dd>
                  {/* sublinhado animado */}
                  <a
                    href={`mailto:${CONTACT.email}`}
                    className="relative underline decoration-transparent underline-offset-[6px]
                               hover:decoration-current transition-[text-decoration-color] duration-300
                               after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-[2px]
                               after:w-full after:scale-x-0 after:bg-current after:origin-left
                               after:transition-transform after:duration-300 hover:after:scale-x-100"
                  >
                    {CONTACT.email}
                  </a>
                </dd>

                <dt className="opacity-70">Endereço</dt>
                <dd className="space-y-0.5">{CONTACT.address}</dd>
              </dl>

              {/* Sociais à direita, com lifts/hover */}
              <div className="mt-5 flex items-center gap-3">
                <IconTile href={SOCIAL.site} label="Site">
                  <FontAwesomeIcon className="h-4 w-4" icon={faGlobe} />
                </IconTile>

                <IconTile href={SOCIAL.instagram} label="Instagram">
                  <FontAwesomeIcon className="h-4 w-4" icon={faInstagram} />
                </IconTile>

                <IconTile href={SOCIAL.linkedin} label="LinkedIn">
                  <FontAwesomeIcon className="h-4 w-4" icon={faLinkedin} />
                </IconTile>
              </div>
            </div>
          </div>

          {/* separador */}
          <div className="mt-8 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

          {/* Linha inferior — Powered by (lista) | Copyright */}
          <div className="mt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Powered by em lista com ícone do LinkedIn */}
            <div>
              <span className="block text-xs md:text-sm opacity-90 mb-2">
                Powered by:
              </span>
              <ul className="space-y-2">
                {TEAM.map(({ name, role, linkedin }) => (
                  <li
                    key={name}
                    className="group flex items-center gap-2 text-sm md:text-[15px] transition-all duration-300"
                  >
                    {/* tile do LinkedIn com micro-lift + brilho */}
                    <a
                      href={linkedin || "#"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md
                                 bg-black/5 dark:bg-white/10
                                 ring-1 ring-black/10 dark:ring-white/10
                                 hover:bg-black/10 dark:hover:bg-white/20
                                 hover:ring-black/20 dark:hover:ring-white/20
                                 transition-all duration-300 ease-out
                                 focus-visible:outline-none focus-visible:ring-2
                                 focus-visible:ring-black/30 dark:focus-visible:ring-white/30
                                 translate-y-0 group-hover:-translate-y-0.5"
                      aria-label={`LinkedIn de ${name}`}
                      title={`LinkedIn de ${name}`}
                    >
                      <FontAwesomeIcon icon={faLinkedin} className="h-4 w-4" />
                    </a>

                    {/* nome com leve slide no hover */}
                    <span className="font-medium transition-transform duration-300 group-hover:translate-x-0.5">
                      {name}
                      <span className="opacity-70"> — {role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs md:text-sm opacity-90">
              © {year} Etheriumtech. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Bloco para ícone social com micro-interações */
function IconTile({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="group relative grid h-10 w-10 place-items-center rounded-lg
                 bg-black/5 dark:bg-white/10
                 ring-1 ring-black/10 dark:ring-white/10
                 hover:bg-black/10 dark:hover:bg-white/20
                 hover:ring-black/20 dark:hover:ring-white/20
                 transition-all duration-300 ease-out
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-black/30 dark:focus-visible:ring-white/30
                 translate-y-0 hover:-translate-y-0.5"
    >
      {/* brilho sutil ao hover */}
      <span className="pointer-events-none absolute inset-0 rounded-lg opacity-0
                       transition-opacity duration-300 ease-out
                       bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)]
                       group-hover:opacity-100" />
      <span className="relative">{children}</span>
    </a>
  );
}
