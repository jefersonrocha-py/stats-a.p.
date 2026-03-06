"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
};

export default function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "itens",
}: Props) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(page, safeTotalPages));
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.04] md:flex-row md:items-center md:justify-between">
      <div className="opacity-75">
        {totalItems === 0
          ? `Nenhum ${itemLabel}`
          : `Mostrando ${start}-${end} de ${totalItems} ${itemLabel}`}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
          aria-label="Primeira pagina"
        >
          {"<<"}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
          aria-label="Pagina anterior"
        >
          {"<"}
        </button>
        <span className="min-w-28 text-center font-medium">
          Pagina {safePage} de {safeTotalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
          aria-label="Proxima pagina"
        >
          {">"}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safePage >= safeTotalPages}
          className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
          aria-label="Ultima pagina"
        >
          {">>"}
        </button>
      </div>
    </div>
  );
}
