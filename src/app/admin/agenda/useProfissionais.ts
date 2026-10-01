"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdmin, mensagemDe } from "../fetchAdmin";
import type { ProfissionalAgenda } from "./tipos";

interface RespostaProfissionais {
  profissionais: ProfissionalAgenda[];
}

interface EstadoProfissionais {
  profissionais: ProfissionalAgenda[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Carrega os profissionais ativos quando `ativo` é verdadeiro
 * (usado pelos modais de nova reserva e novo horário fixo).
 */
export function useProfissionaisAtivos(ativo: boolean): EstadoProfissionais {
  const [profissionais, setProfissionais] = useState<ProfissionalAgenda[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    fetchAdmin<RespostaProfissionais>("/api/admin/profissionais")
      .then((dados) => {
        if (cancelado) return;
        setProfissionais(dados.profissionais.filter((p) => p.situacao === "ativo"));
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setErro(mensagemDe(e));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [ativo, versao]);

  return { profissionais, carregando, erro, recarregar };
}
