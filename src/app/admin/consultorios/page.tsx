"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { TIPOS_RESERVA } from "@/lib/constants";
import { formatarData, formatarMoeda, hojeIso } from "@/lib/dates";

/* ---------------------------------------------------------------- tipos */

interface Foto {
  id: number;
  url: string;
  alt: string;
  ordem: number;
  situacao: string;
}

interface Preco {
  id: number;
  tipo: string;
  valor_cents: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  situacao: string;
}

interface Consultorio {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  recursos: string;
  situacao: string;
  fotos: Foto[];
  precos: Preco[];
}

interface FormInfo {
  nome: string;
  descricao: string;
  recursos: string;
  situacao: string;
}

interface FormPreco {
  tipo: string;
  valor: string;
  vigencia_inicio: string;
  vigencia_fim: string;
}

interface FormPrecoEdicao {
  valor: string;
  vigencia_fim: string;
  situacao: string;
}

interface Mensagem {
  tipo: "ok" | "erro";
  texto: string;
}

interface Confirmacao {
  titulo: string;
  texto: string;
  confirmarRotulo: string;
  perigo: boolean;
  /** Retorna null em caso de sucesso ou a mensagem de erro. */
  executar: () => Promise<string | null>;
}

/* ------------------------------------------------------- helper de rede */

class RequisicaoErro extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = "RequisicaoErro";
    this.status = status;
  }
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado.";
}

async function requisicao<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    throw new RequisicaoErro(0, "Falha na conexão");
  }
  if (resposta.status === 401) {
    window.location.href = "/login?expirada=1";
    throw new RequisicaoErro(401, "Sessão expirada.");
  }
  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }
  if (!resposta.ok) {
    const corpo = dados as { erro?: unknown } | null;
    const mensagem =
      corpo && typeof corpo.erro === "string" ? corpo.erro : `Erro ${resposta.status} ao processar a solicitação.`;
    throw new RequisicaoErro(resposta.status, mensagem);
  }
  return dados as T;
}

function corpoJson(metodo: string, dados: unknown): RequestInit {
  return {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  };
}

/* ------------------------------------------------------------ utilidades */

/** "Poltrona;Ar-condicionado" -> "Poltrona\nAr-condicionado" */
function linhasDeRecursos(recursos: string): string {
  return recursos
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)
    .join("\n");
}

/** "Poltrona\nAr-condicionado" -> "Poltrona;Ar-condicionado" */
function recursosDeLinhas(linhas: string): string {
  return linhas
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .join(";");
}

function rotuloTipo(tipo: string): string {
  if (tipo === "fixo" || tipo === "avulsa" || tipo === "reposicao") return TIPOS_RESERVA[tipo].rotulo;
  return tipo;
}

function textoMoeda(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const FORMATOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

/* ------------------------------------------------- item da galeria de fotos */

interface FotoItemProps {
  foto: Foto;
  indice: number;
  total: number;
  aoMover: (foto: Foto, direcao: -1 | 1) => void;
  aoAlternar: (foto: Foto) => void;
  aoExcluir: (foto: Foto) => void;
  aoSalvarAlt: (foto: Foto, alt: string) => void;
}

function FotoItem({ foto, indice, total, aoMover, aoAlternar, aoExcluir, aoSalvarAlt }: FotoItemProps) {
  const [alt, setAlt] = useState(foto.alt);
  const oculta = foto.situacao === "inativo";

  return (
    <li className={`card p-3 ${oculta ? "opacity-70" : ""}`}>
      <img
        src={foto.url}
        alt={foto.alt}
        className="h-28 w-full rounded-lg border border-slate-200 object-cover"
        loading="lazy"
      />
      <div className="mt-2">
        <label className="rotulo" htmlFor={`alt-foto-${foto.id}`}>
          Texto alternativo (alt)
        </label>
        <div className="flex gap-2">
          <input
            id={`alt-foto-${foto.id}`}
            className="campo"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            aria-label={`Descrição da foto ${indice + 1}`}
          />
          <button
            type="button"
            className="btn-secundario shrink-0"
            onClick={() => aoSalvarAlt(foto, alt)}
            aria-label={`Salvar descrição da foto ${indice + 1}`}
          >
            Salvar
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secundario px-3"
          onClick={() => aoMover(foto, -1)}
          disabled={indice === 0}
          aria-label={`Mover foto ${indice + 1} para cima`}
          title="Mover para cima"
        >
          ↑
        </button>
        <button
          type="button"
          className="btn-secundario px-3"
          onClick={() => aoMover(foto, 1)}
          disabled={indice === total - 1}
          aria-label={`Mover foto ${indice + 1} para baixo`}
          title="Mover para baixo"
        >
          ↓
        </button>
        <button
          type="button"
          className="btn-secundario"
          onClick={() => aoAlternar(foto)}
          aria-label={oculta ? `Mostrar foto ${indice + 1}` : `Ocultar foto ${indice + 1}`}
        >
          {oculta ? "Mostrar" : "Ocultar"}
        </button>
        <button
          type="button"
          className="btn-perigo"
          onClick={() => aoExcluir(foto)}
          aria-label={`Excluir foto ${indice + 1}`}
        >
          Excluir
        </button>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
            oculta ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-800"
          }`}
        >
          {oculta ? "Oculta" : "Visível"}
        </span>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------- página */

export default function PaginaConsultorios() {
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [ativoId, setAtivoId] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  // informações
  const [formInfo, setFormInfo] = useState<FormInfo>({ nome: "", descricao: "", recursos: "", situacao: "ativo" });
  const [erroInfo, setErroInfo] = useState<string | null>(null);
  const [salvandoInfo, setSalvandoInfo] = useState(false);

  // galeria
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [altNovo, setAltNovo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  // confirmação genérica (excluir foto/preço)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [processandoConfirmacao, setProcessandoConfirmacao] = useState(false);

  // preços
  const [novoPrecoAberto, setNovoPrecoAberto] = useState(false);
  const [formPreco, setFormPreco] = useState<FormPreco>({
    tipo: "avulsa",
    valor: "",
    vigencia_inicio: hojeIso(),
    vigencia_fim: "",
  });
  const [editandoPreco, setEditandoPreco] = useState<Preco | null>(null);
  const [formPrecoEdicao, setFormPrecoEdicao] = useState<FormPrecoEdicao>({
    valor: "",
    vigencia_fim: "",
    situacao: "ativo",
  });
  const [erroPreco, setErroPreco] = useState<string | null>(null);
  const [salvandoPreco, setSalvandoPreco] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const dados = await requisicao<{ consultorios: Consultorio[] }>("/api/admin/consultorios");
      setConsultorios(dados.consultorios);
    } catch (e) {
      setErroLista(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const alvo: Consultorio | null =
    consultorios.find((c) => c.id === ativoId) ?? consultorios[0] ?? null;

  // Sincroniza o formulário de informações com o consultório selecionado.
  useEffect(() => {
    if (!alvo) return;
    setFormInfo({
      nome: alvo.nome,
      descricao: alvo.descricao,
      recursos: linhasDeRecursos(alvo.recursos),
      situacao: alvo.situacao,
    });
    setErroInfo(null);
    setArquivo(null);
    setAltNovo("");
    setErroUpload(null);
    setProgresso(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.id]);

  /* -------------------------------------------------------- informações */

  async function salvarInfo(): Promise<void> {
    if (!alvo) return;
    if (!formInfo.nome.trim()) {
      setErroInfo("Nome é obrigatório.");
      return;
    }
    setSalvandoInfo(true);
    setErroInfo(null);
    try {
      await requisicao(
        `/api/admin/consultorios/${alvo.id}`,
        corpoJson("PUT", {
          nome: formInfo.nome.trim(),
          descricao: formInfo.descricao.trim(),
          recursos: recursosDeLinhas(formInfo.recursos),
          situacao: formInfo.situacao,
        })
      );
      setMensagem({ tipo: "ok", texto: "Informações do consultório salvas." });
      await carregar();
    } catch (e) {
      setErroInfo(mensagemDe(e));
    } finally {
      setSalvandoInfo(false);
    }
  }

  /* ------------------------------------------------------------- fotos */

  async function salvarAlt(foto: Foto, alt: string): Promise<void> {
    if (!alvo) return;
    try {
      await requisicao(`/api/admin/fotos/${foto.id}`, corpoJson("PUT", { alt: alt.trim() }));
      setMensagem({ tipo: "ok", texto: "Descrição da foto atualizada." });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDe(e) });
    }
  }

  async function moverFoto(foto: Foto, direcao: -1 | 1): Promise<void> {
    if (!alvo) return;
    const lista = [...alvo.fotos].sort((a, b) => a.ordem - b.ordem);
    const indice = lista.findIndex((f) => f.id === foto.id);
    const destino = indice + direcao;
    if (indice < 0 || destino < 0 || destino >= lista.length) return;
    const atual = lista[indice];
    const vizinha = lista[destino];
    try {
      await requisicao(`/api/admin/fotos/${atual.id}`, corpoJson("PUT", { ordem: vizinha.ordem }));
      await requisicao(`/api/admin/fotos/${vizinha.id}`, corpoJson("PUT", { ordem: atual.ordem }));
      await carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDe(e) });
    }
  }

  async function alternarFoto(foto: Foto): Promise<void> {
    try {
      await requisicao(
        `/api/admin/fotos/${foto.id}`,
        corpoJson("PUT", { situacao: foto.situacao === "inativo" ? "ativo" : "inativo" })
      );
      setMensagem({
        tipo: "ok",
        texto: foto.situacao === "inativo" ? "Foto visível novamente." : "Foto oculta da galeria pública.",
      });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDe(e) });
    }
  }

  function pedirExclusaoFoto(foto: Foto): void {
    setErroConfirmacao(null);
    setProcessandoConfirmacao(false);
    setConfirmacao({
      titulo: "Excluir foto",
      texto: "A foto será removida da galeria do consultório. Esta ação não pode ser desfeita.",
      confirmarRotulo: "Excluir",
      perigo: true,
      executar: async () => {
        try {
          await requisicao(`/api/admin/fotos/${foto.id}`, { method: "DELETE" });
          setMensagem({ tipo: "ok", texto: "Foto excluída." });
          await carregar();
          return null;
        } catch (e) {
          return mensagemDe(e);
        }
      },
    });
  }

  async function executarConfirmacao(): Promise<void> {
    if (!confirmacao) return;
    setProcessandoConfirmacao(true);
    setErroConfirmacao(null);
    const erro = await confirmacao.executar();
    setProcessandoConfirmacao(false);
    if (erro) setErroConfirmacao(erro);
    else setConfirmacao(null);
  }

  async function enviarFoto(): Promise<void> {
    if (!alvo) return;
    if (!arquivo) {
      setErroUpload("Selecione uma imagem para enviar.");
      return;
    }
    if (!FORMATOS_ACEITOS.includes(arquivo.type)) {
      setErroUpload("Formato não suportado. Use JPG, PNG, WEBP ou AVIF.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setErroUpload("Arquivo maior que 8 MB.");
      return;
    }

    setEnviando(true);
    setErroUpload(null);
    setProgresso(5);
    const timer = window.setInterval(() => {
      setProgresso((p) => (p < 90 ? p + 5 : p));
    }, 150);

    try {
      const dados = new FormData();
      dados.append("arquivo", arquivo);
      dados.append("alt", altNovo.trim());
      await requisicao(`/api/admin/consultorios/${alvo.id}/fotos`, { method: "POST", body: dados });
      setProgresso(100);
      setMensagem({ tipo: "ok", texto: "Foto enviada com sucesso." });
      setArquivo(null);
      setAltNovo("");
      const input = document.getElementById("foto-arquivo") as HTMLInputElement | null;
      if (input) input.value = "";
      await carregar();
    } catch (e) {
      setErroUpload(mensagemDe(e));
    } finally {
      window.clearInterval(timer);
      setEnviando(false);
      setProgresso(0);
    }
  }

  /* ----------------------------------------------------------- preços */

  function abrirNovoPreco(): void {
    setFormPreco({ tipo: "avulsa", valor: "", vigencia_inicio: hojeIso(), vigencia_fim: "" });
    setErroPreco(null);
    setNovoPrecoAberto(true);
  }

  async function salvarNovoPreco(): Promise<void> {
    if (!alvo) return;
    if (!formPreco.valor.trim()) {
      setErroPreco("Informe um valor válido (ex.: 120,00).");
      return;
    }
    setSalvandoPreco(true);
    setErroPreco(null);
    try {
      await requisicao(
        `/api/admin/consultorios/${alvo.id}/precos`,
        corpoJson("POST", {
          tipo: formPreco.tipo,
          valor: formPreco.valor.trim(),
          vigencia_inicio: formPreco.vigencia_inicio || undefined,
          vigencia_fim: formPreco.vigencia_fim || undefined,
        })
      );
      setNovoPrecoAberto(false);
      setMensagem({ tipo: "ok", texto: "Novo preço cadastrado." });
      await carregar();
    } catch (e) {
      setErroPreco(mensagemDe(e));
    } finally {
      setSalvandoPreco(false);
    }
  }

  function abrirEdicaoPreco(preco: Preco): void {
    setFormPrecoEdicao({
      valor: textoMoeda(preco.valor_cents),
      vigencia_fim: preco.vigencia_fim ?? "",
      situacao: preco.situacao,
    });
    setErroPreco(null);
    setEditandoPreco(preco);
  }

  async function salvarEdicaoPreco(): Promise<void> {
    if (!editandoPreco) return;
    if (!formPrecoEdicao.valor.trim()) {
      setErroPreco("Informe um valor válido (ex.: 120,00).");
      return;
    }
    setSalvandoPreco(true);
    setErroPreco(null);
    try {
      await requisicao(
        `/api/admin/precos/${editandoPreco.id}`,
        corpoJson("PUT", {
          valor: formPrecoEdicao.valor.trim(),
          vigencia_fim: formPrecoEdicao.vigencia_fim || null,
          situacao: formPrecoEdicao.situacao,
        })
      );
      setEditandoPreco(null);
      setMensagem({ tipo: "ok", texto: "Preço atualizado. Reservas antigas permanecem com o valor acordado." });
      await carregar();
    } catch (e) {
      setErroPreco(mensagemDe(e));
    } finally {
      setSalvandoPreco(false);
    }
  }

  function pedirExclusaoPreco(preco: Preco): void {
    setErroConfirmacao(null);
    setProcessandoConfirmacao(false);
    setConfirmacao({
      titulo: "Excluir preço",
      texto: `Excluir o preço de ${formatarMoeda(preco.valor_cents)} (${rotuloTipo(preco.tipo)})? Reservas antigas não são afetadas.`,
      confirmarRotulo: "Excluir",
      perigo: true,
      executar: async () => {
        try {
          await requisicao(`/api/admin/precos/${preco.id}`, { method: "DELETE" });
          setMensagem({ tipo: "ok", texto: "Preço excluído." });
          await carregar();
          return null;
        } catch (e) {
          return mensagemDe(e);
        }
      },
    });
  }

  /* ---------------------------------------------------------- render */

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Consultórios</h1>
        <p className="text-sm text-slate-500">
          Informações, galeria de fotos e preços de cada consultório.
        </p>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === "ok" ? "status" : "alert"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            mensagem.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      {carregando ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando consultórios...
        </p>
      ) : erroLista ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erroLista}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : !alvo ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nenhum consultório cadastrado.</p>
      ) : (
        <>
          <div role="group" aria-label="Selecionar consultório" className="flex flex-wrap gap-2">
            {consultorios.map((c) => (
              <button
                key={c.id}
                type="button"
                className={c.id === alvo.id ? "btn-primario" : "btn-secundario"}
                aria-pressed={c.id === alvo.id}
                onClick={() => setAtivoId(c.id)}
              >
                {c.nome}
              </button>
            ))}
          </div>

          {/* ------------------------------------------------ informações */}
          <section className="card p-5" aria-label={`Informações de ${alvo.nome}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Informações</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  alvo.situacao === "ativo" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {alvo.situacao === "ativo" ? "Ativo" : "Inativo"}
              </span>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void salvarInfo();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="rotulo" htmlFor="info-nome">
                    Nome *
                  </label>
                  <input
                    id="info-nome"
                    className="campo"
                    required
                    value={formInfo.nome}
                    onChange={(e) => setFormInfo({ ...formInfo, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="rotulo" htmlFor="info-situacao">
                    Situação
                  </label>
                  <select
                    id="info-situacao"
                    className="campo"
                    value={formInfo.situacao}
                    onChange={(e) => setFormInfo({ ...formInfo, situacao: e.target.value })}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="rotulo" htmlFor="info-descricao">
                  Descrição
                </label>
                <textarea
                  id="info-descricao"
                  className="campo"
                  rows={3}
                  value={formInfo.descricao}
                  onChange={(e) => setFormInfo({ ...formInfo, descricao: e.target.value })}
                />
              </div>
              <div>
                <label className="rotulo" htmlFor="info-recursos">
                  Recursos (um por linha)
                </label>
                <textarea
                  id="info-recursos"
                  className="campo"
                  rows={4}
                  placeholder={"Poltrona confortável\nAr-condicionado\nWi-Fi"}
                  value={formInfo.recursos}
                  onChange={(e) => setFormInfo({ ...formInfo, recursos: e.target.value })}
                  aria-describedby="info-recursos-ajuda"
                />
                <p id="info-recursos-ajuda" className="mt-1 text-xs text-slate-500">
                  Cada linha vira um item da lista exibida no site.
                </p>
              </div>
              {erroInfo && (
                <p role="alert" className="text-sm text-red-700">
                  {erroInfo}
                </p>
              )}
              <div className="flex justify-end">
                <button type="submit" className="btn-primario" disabled={salvandoInfo}>
                  {salvandoInfo ? "Salvando..." : "Salvar informações"}
                </button>
              </div>
            </form>
          </section>

          {/* ----------------------------------------------------- fotos */}
          <section className="card p-5" aria-label={`Galeria de fotos de ${alvo.nome}`}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Fotos</h2>

            <form
              className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void enviarFoto();
              }}
            >
              <div>
                <label className="rotulo" htmlFor="foto-arquivo">
                  Imagem (JPG, PNG, WEBP ou AVIF — até 8 MB)
                </label>
                <input
                  id="foto-arquivo"
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
                  onChange={(e) => {
                    setArquivo(e.target.files && e.target.files.length > 0 ? e.target.files[0] : null);
                    setErroUpload(null);
                  }}
                />
              </div>
              <div>
                <label className="rotulo" htmlFor="foto-alt">
                  Texto alternativo (alt)
                </label>
                <input
                  id="foto-alt"
                  className="campo"
                  placeholder="Ex.: Consultório 01 com poltronas"
                  value={altNovo}
                  onChange={(e) => setAltNovo(e.target.value)}
                />
              </div>

              {enviando && (
                <div role="status" aria-live="polite">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-petroleo-600 transition-all duration-200"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">Enviando... {progresso}%</p>
                </div>
              )}

              {erroUpload && (
                <p role="alert" className="text-sm text-red-700">
                  {erroUpload}
                </p>
              )}

              <button type="submit" className="btn-primario" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar foto"}
              </button>
            </form>

            {alvo.fotos.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Nenhuma foto cadastrada.</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...alvo.fotos]
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((foto, indice, lista) => (
                    <FotoItem
                      key={foto.id}
                      foto={foto}
                      indice={indice}
                      total={lista.length}
                      aoMover={(f, d) => void moverFoto(f, d)}
                      aoAlternar={(f) => void alternarFoto(f)}
                      aoExcluir={pedirExclusaoFoto}
                      aoSalvarAlt={(f, alt) => void salvarAlt(f, alt)}
                    />
                  ))}
              </ul>
            )}
          </section>

          {/* ---------------------------------------------------- preços */}
          <section className="card p-5" aria-label={`Preços de ${alvo.nome}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Preços</h2>
              <button type="button" className="btn-primario" onClick={abrirNovoPreco}>
                Novo preço
              </button>
            </div>
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Alterar o preço não modifica reservas e lançamentos antigos (valor acordado é preservado).
            </p>

            {alvo.precos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum preço cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Tipo
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Valor
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Vigência
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Situação
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alvo.precos.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-800">{rotuloTipo(p.tipo)}</td>
                        <td className="py-2 pr-3">{formatarMoeda(p.valor_cents)}</td>
                        <td className="py-2 pr-3">
                          {formatarData(p.vigencia_inicio)} a{" "}
                          {p.vigencia_fim ? formatarData(p.vigencia_fim) : "em aberto"}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.situacao === "ativo" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {p.situacao === "ativo" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-secundario" onClick={() => abrirEdicaoPreco(p)}>
                              Editar
                            </button>
                            <button type="button" className="btn-perigo" onClick={() => pedirExclusaoPreco(p)}>
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ------------------------------------------------- novo preço */}
      <Modal
        aberto={novoPrecoAberto}
        aoFechar={() => setNovoPrecoAberto(false)}
        titulo="Novo preço"
        descricao={alvo ? alvo.nome : undefined}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarNovoPreco();
          }}
        >
          <div>
            <label className="rotulo" htmlFor="preco-tipo">
              Tipo de reserva
            </label>
            <select
              id="preco-tipo"
              className="campo"
              value={formPreco.tipo}
              onChange={(e) => setFormPreco({ ...formPreco, tipo: e.target.value })}
            >
              <option value="fixo">{TIPOS_RESERVA.fixo.rotulo}</option>
              <option value="avulsa">{TIPOS_RESERVA.avulsa.rotulo}</option>
              <option value="reposicao">{TIPOS_RESERVA.reposicao.rotulo}</option>
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="preco-valor">
              Valor (R$)
            </label>
            <input
              id="preco-valor"
              className="campo"
              inputMode="decimal"
              placeholder="120,00"
              required
              value={formPreco.valor}
              onChange={(e) => setFormPreco({ ...formPreco, valor: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="preco-vigencia-inicio">
                Vigência inicial
              </label>
              <input
                id="preco-vigencia-inicio"
                className="campo"
                type="date"
                value={formPreco.vigencia_inicio}
                onChange={(e) => setFormPreco({ ...formPreco, vigencia_inicio: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="preco-vigencia-fim">
                Vigência final (opcional)
              </label>
              <input
                id="preco-vigencia-fim"
                className="campo"
                type="date"
                value={formPreco.vigencia_fim}
                onChange={(e) => setFormPreco({ ...formPreco, vigencia_fim: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Alterar o preço não modifica reservas e lançamentos antigos (valor acordado é preservado).
          </p>
          {erroPreco && (
            <p role="alert" className="text-sm text-red-700">
              {erroPreco}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setNovoPrecoAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvandoPreco}>
              {salvandoPreco ? "Salvando..." : "Cadastrar preço"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ----------------------------------------------- editar preço */}
      <Modal
        aberto={editandoPreco !== null}
        aoFechar={() => setEditandoPreco(null)}
        titulo="Editar preço"
        descricao={editandoPreco ? rotuloTipo(editandoPreco.tipo) : undefined}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarEdicaoPreco();
          }}
        >
          <div>
            <label className="rotulo" htmlFor="edt-preco-valor">
              Valor (R$)
            </label>
            <input
              id="edt-preco-valor"
              className="campo"
              inputMode="decimal"
              placeholder="120,00"
              required
              value={formPrecoEdicao.valor}
              onChange={(e) => setFormPrecoEdicao({ ...formPrecoEdicao, valor: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="edt-preco-vigencia-fim">
                Vigência final
              </label>
              <input
                id="edt-preco-vigencia-fim"
                className="campo"
                type="date"
                value={formPrecoEdicao.vigencia_fim}
                onChange={(e) => setFormPrecoEdicao({ ...formPrecoEdicao, vigencia_fim: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="edt-preco-situacao">
                Situação
              </label>
              <select
                id="edt-preco-situacao"
                className="campo"
                value={formPrecoEdicao.situacao}
                onChange={(e) => setFormPrecoEdicao({ ...formPrecoEdicao, situacao: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Alterar o preço não modifica reservas e lançamentos antigos (valor acordado é preservado).
          </p>
          {erroPreco && (
            <p role="alert" className="text-sm text-red-700">
              {erroPreco}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setEditandoPreco(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvandoPreco}>
              {salvandoPreco ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------- confirmação genérica */}
      <Modal
        aberto={confirmacao !== null}
        aoFechar={() => setConfirmacao(null)}
        titulo={confirmacao?.titulo ?? "Confirmar"}
        largura="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{confirmacao?.texto}</p>
          {erroConfirmacao && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {erroConfirmacao}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setConfirmacao(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={confirmacao?.perigo ? "btn-perigo" : "btn-primario"}
              disabled={processandoConfirmacao}
              onClick={() => void executarConfirmacao()}
            >
              {processandoConfirmacao
                ? "Processando..."
                : confirmacao?.confirmarRotulo ?? "Confirmar"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
