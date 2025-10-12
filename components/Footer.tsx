"use client";

import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";

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
      className="relative w-full mt-8 rounded-2xl overflow-hidden
                 bg-white/60 dark:bg-neutral-900/70
                 backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10"
    >
      {/* linha superior */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

      {/* glow decorativo suave (bem discreto) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[1px] rounded-[18px]
                   bg-[radial-gradient(120px_70px_at_12%_-15%,rgba(16,185,129,0.10),transparent),
                       radial-gradient(120px_70px_at_88%_115%,rgba(59,130,246,0.08),transparent)]"
      />

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-6 md:py-8">
          {/* GRID principal — esquerda (texto+CTA) / direita (contato) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
            {/* ESQUERDA */}
            <div className="md:col-span-7">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {PRODUCT_TITLE}
              </h2>

              <p className="mt-2.5 text-[15px] md:text-base opacity-90 leading-relaxed max-w-prose [text-wrap:balance]">
                {PRODUCT_COPY}
              </p>

              {/* CTA enxuta, com micro-lift e brilho */}
              <div className="mt-4">
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="group relative inline-flex items-center justify-center rounded-lg
                             border border-black/15 dark:border-white/15
                             bg-black/5 dark:bg-white/10
                             hover:bg-black/10 dark:hover:bg-white/20
                             transition-all duration-300 ease-out
                             px-4 py-2 text-sm font-medium
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-black/30 dark:focus-visible:ring-white/30
                             translate-y-0 hover:-translate-y-0.5"
                >
                  <span className="pointer-events-none absolute inset-0 rounded-lg opacity-0
                                   transition-opacity duration-300 ease-out
                                   bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.14),transparent)]
                                   group-hover:opacity-100" />
                  <span className="relative">Fale conosco por e-mail</span>
                </a>
              </div>
            </div>

            {/* DIREITA — bloco mais compacto */}
            <div className="md:col-span-5">
              {/* labels com largura fixa para alinhar baseline, gaps menores */}
              <dl className="grid grid-cols-[88px,1fr] items-center gap-x-4 gap-y-1.5 text-[15px]">
                <dt className="opacity-70">Email</dt>
                <dd className="truncate">
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
                <dd className="whitespace-normal">{CONTACT.address}</dd>
              </dl>

              {/* Sociais: chips circulares melhores, sem “quadradão”, com hover/lift */}
              <div className="mt-3.5 flex items-center gap-2.5">
                <IconButton href={SOCIAL.site} label="Site">
                  <FontAwesomeIcon className="h-[18px] w-[18px]" icon={faGlobe} />
                </IconButton>

                <IconButton href={SOCIAL.instagram} label="Instagram">
                  <FontAwesomeIcon className="h-[18px] w-[18px]" icon={faInstagram} />
                </IconButton>

                <IconButton href={SOCIAL.linkedin} label="LinkedIn">
                  <FontAwesomeIcon className="h-[18px] w-[18px]" icon={faLinkedin} />
                </IconButton>
              </div>
            </div>
          </div>

          {/* separador enxuto */}
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

          {/* Linha inferior — Powered by (lista) | Copyright */}
          <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Powered by em lista, ícone do LinkedIn antes do nome */}
            <div>
              <span className="block text-xs md:text-sm opacity-90 mb-1.5">
                Powered by:
              </span>
              <ul className="space-y-1.5">
                {TEAM.map(({ name, role, linkedin }) => (
                  <li
                    key={name}
                    className="group flex items-center gap-2 text-[15px] transition-all duration-300"
                  >
                    <a
                      href={linkedin || "#"}
                      className="inline-flex size-8 items-center justify-center rounded-full
                                 bg-gradient-to-b from-white/10 to-white/[0.06] dark:from-white/10 dark:to-white/[0.06]
                                 ring-1 ring-black/10 dark:ring-white/10
                                 hover:ring-black/20 dark:hover:ring-white/20
                                 transition-all duration-300 ease-out
                                 focus-visible:outline-none focus-visible:ring-2
                                 focus-visible:ring-black/30 dark:focus-visible:ring-white/30
                                 translate-y-0 group-hover:-translate-y-0.5"
                      aria-label={`LinkedIn de ${name}`}
                      title={`LinkedIn de ${name}`}
                    >
                      <FontAwesomeIcon icon={faLinkedin} className="h-[15px] w-[15px]" />
                    </a>

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

/** Ícone social circular com micro-interações e brilho suave */
function IconButton({
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
      className="group relative grid size-9 place-items-center rounded-full
                 bg-gradient-to-b from-white/10 to-white/[0.06] dark:from-white/10 dark:to-white/[0.06]
                 ring-1 ring-black/10 dark:ring-white/10
                 hover:ring-black/20 dark:hover:ring-white/20
                 transition-all duration-300 ease-out
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-black/30 dark:focus-visible:ring-white/30
                 translate-y-0 hover:-translate-y-0.5"
    >
      {/* sheen */}
      <span className="pointer-events-none absolute inset-0 rounded-full opacity-0
                       transition-opacity duration-300 ease-out
                       bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.22),transparent)]
                       group-hover:opacity-100" />
      <span className="relative">{children}</span>
    </a>
  );
}
