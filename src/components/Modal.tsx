"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

/** Diálogo acessível: fecha no Escape, fundo clicável e foco inicial. */
export function Modal({ aberto, aoFechar, titulo, descricao, largura = "md", children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (aberto && !el.open) el.showModal();
    if (!aberto && el.open) el.close();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, aoFechar]);

  const larguras = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className={`m-auto w-[calc(100vw-2rem)] ${larguras[largura]} rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/50`}
      aria-labelledby="modal-titulo"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 id="modal-titulo" className="text-lg font-semibold text-slate-900">
            {titulo}
          </h2>
          {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
