# API — HumanaMentePsi (contrato para as telas)

Stack: Next.js 16 App Router + React 19 + Tailwind v4 + SQLite (`node:sqlite`).
Todos os handlers ficam em `src/app/api/**/route.ts`. Respostas: JSON `{ ... }` ou `{ erro: string }`.
Erros: 400 validação, 401 sem sessão, 404 inexistente, 409 conflito (`{erro, conflito:true}`), 500 servidor.
**Nunca exibir sucesso antes da resposta do servidor.**

## Convenções de UI

- Classes utilitárias locais (globals.css): `.card`, `.btn-primario`, `.btn-secundario`, `.btn-perigo`, `.campo`, `.rotulo`.
- Slots da agenda: `.slot .slot-livre .slot-ocupado .slot-fixo .slot-avulso .slot-reposicao .slot-pendente .slot-cancelado`.
- Cores: azul-petróleo `petroleo-*` (fixo/identidade), `salvia-*` (avulso), `laranja-*` (reposição), `amarelo-*` (pendente), cinza/branco (livre).
- Moeda: `formatarMoeda(cents)` de `@/lib/dates` (R$ pt-BR). Datas: `formatarData`, `formatarDataLonga`, `formatarDataCurta`, `formatarHora(inicio, fim)` de `@/lib/dates`.
- Constantes: `@/lib/constants` (TIPOS_RESERVA, DIAS_SEMANA, FORMAS_PAGAMENTO, SITUACOES_FINANCEIRAS, WHATSAPP_EXIBICAO, ENDERECO).
- Grade: horas 7..20 (bloco início), segunda a sábado, domingo bloqueado. `horariosValidos()` de `@/lib/constants`.
- Polling de tempo real: `useEffect` com `setInterval(fetch, 10000)` + refetch ao focar da janela.

## Públicos (sem autenticação)

### GET /api/public/rooms
`{ consultorios: [{ id, nome, slug, descricao, recursos: string[], fotos: [{id,url,alt,ordem}], precos: {"fixo"|"avulsa"|"reposicao": valor_cents} }] }`
Preço ausente ⇒ exibir "Consulte o valor" (RF-057).

### GET /api/public/availability?inicio=YYYY-MM-DD&dias=7
`{ inicio, fim, consultorios: [{ id, nome, slug, dias: [{ data, dow, rotulo, domingo, horarios: [{ hora, status: "livre"|"ocupado"|"bloqueado" }] }] }] }`
Sem nomes de profissionais, sem valores (RF-016).

### POST /api/public/solicitacoes
body `{ nome, telefone, consultorio_id, data, inicio, tipo }` → 201 `{ ok, id, situacao:"pendente" }`.
Registrar a solicitação ANTES de abrir o WhatsApp (RF-037). **Nunca** tratar como reserva confirmada (RF-036).

### Link WhatsApp
`montarLinkWhatsApp({ nome, consultorio, data, inicio, fim, tipo })` de `@/lib/whatsapp` → `https://wa.me/...?text=...`.

## Autenticação

- `POST /api/auth/login` body `{ email, senha }` → 200 `{ok, nome}` / 401. Cookie httpOnly 8h.
- `POST /api/auth/logout` → `{ok}`.
- `GET /api/auth/me` → `{ autenticado: boolean, sessao: {adminId,nome,email}|null }`.
- Credenciais iniciais: `admin@humamentepsi.com` + senha definida via `ADMIN_SENHA_INICIAL` no primeiro boot (trocar após o primeiro acesso).
- Rotas admin exigem sessão; sem sessão a API devolve 401 → redirecionar para `/login?expirada=1`.

## Admin (cookie de sessão)

### GET /api/admin/dashboard
`{ hoje, rotulo_hoje, reservas_do_dia[], proximas_reservas[], solicitacoes_pendentes[], fixos_ativos[], financeiro: {receita_mes, previsto_mes, pendente, atrasado, recebida_90d} }`
Ocorrências: `{ consultorio_id, data, inicio, fim, tipo, reserva_id, recorrencia_id, profissional_id, nome_profissional, valor_acordado, observacoes }` (dashboard inclui `nome_consultorio`).

### GET /api/admin/agenda?inicio=YYYY-MM-DD&dias=7
`{ inicio, fim, consultorios[], ocorrencias[], solicitacoes[], recorrencias[] }`
- ocorrencias: como acima + valor_acordado, observacoes.
- solicitacoes: `{ id, nome, telefone, consultorio_id, nome_consultorio, data, inicio, fim, tipo, situacao }` (somente pendentes na janela).
- recorrencias: `{ id, dia_semana, inicio, data_inicio, data_fim, nome_consultorio, nome_profissional }`.

### Reservas pontuais
- `POST /api/admin/reservas` body `{ consultorio_id, profissional_id, tipo:"avulsa"|"reposicao", data, inicio, observacoes?, valor? (string BRL), vencimento?, criar_lancamento? }` → 201 `{id, lancamento_id}` | 409 conflito.
- `PUT /api/admin/reservas/[id]` body `{ profissional_id?, data?, inicio?, observacoes?, valor? }`.
- `DELETE /api/admin/reservas/[id]` → cancela (preserva histórico; cancela lançamento sem pagamento).

### Recorrências
- `POST /api/admin/recorrencias` body `{ consultorio_id, profissional_id, dia_semana (1-6), inicio, data_inicio, data_fim?, valor?, observacoes? }` → 409 se conflito em qualquer ocorrência da vigência.
- `PUT /api/admin/recorrencias/[id]` body `{ dia_semana?, inicio?, data_inicio?, data_fim?, profissional_id?, valor?, observacoes?, situacao? }`.
- `DELETE /api/admin/recorrencias/[id]` → encerra a série (RF-020).
- `POST /api/admin/recorrencias/[id]/excecoes` body `{ data, motivo? }` → libera 1 ocorrência (RF-021).
- `DELETE /api/admin/recorrencias/[id]/excecoes?data=YYYY-MM-DD` → reverte a liberação.

### Profissionais
- `GET /api/admin/profissionais?incluir_inativos=1` → `{ profissionais: [{id,nome,profissao,telefone,email,situacao,observacoes}] }`.
- `POST` body `{ nome, profissao?, telefone?, email?, observacoes? }` → `{id}`.
- `GET /api/admin/profissionais/[id]` → `{ profissional, reservas[], recorrencias[] }` (histórico RF-032).
- `PUT /[id]` body `{ nome?, profissao?, telefone?, email?, situacao?:"ativo"|"inativo", observacoes? }`.
- `DELETE /[id]` → 409 se houver vínculos (RF-031): mostrar ação "Inativar".

### Consultórios / fotos / preços
- `GET /api/admin/consultorios` → `{ consultorios: [{id,nome,slug,descricao,recursos,situacao,fotos[{id,url,alt,ordem,situacao}],precos[{id,tipo,valor_cents,vigencia_inicio,vigencia_fim,situacao}]}] }`.
- `PUT /api/admin/consultorios/[id]` body `{ nome?, descricao?, recursos?, situacao? }`.
- `POST /api/admin/consultorios/[id]/fotos` multipart FormData `arquivo` (+`alt`) → `{id,url}`. Máx 8MB, jpg/png/webp/avif.
- `PUT /api/admin/fotos/[id]` `{ alt?, ordem?, situacao? }` | `DELETE /api/admin/fotos/[id]`.
- `POST /api/admin/consultorios/[id]/precos` `{ tipo, valor ("120,00"), vigencia_inicio?, vigencia_fim? }`.
- `PUT /api/admin/precos/[id]` `{ valor?, situacao?, vigencia_fim? }` | `DELETE`.

### Solicitações
- `GET /api/admin/solicitacoes?situacao=pendente|todas` → `{ solicitacoes[] }`.
- `POST` (registro manual) `{ nome, telefone, consultorio_id, data, inicio, tipo, observacoes? }`.
- `POST /api/admin/solicitacoes/[id]/confirmar` body `{ profissional_id, tipo?, valor?, vencimento? }` → 200 `{criado:{tipo,id}}` ou 409 conflito (revalida no servidor, RF-038/039). tipo "fixo" cria recorrência.
- `POST /api/admin/solicitacoes/[id]/recusar` body `{ motivo? }`.

### Financeiro
- `GET /api/admin/lancamentos?profissional_id&consultorio_id&de&ate&situacao` → `{ lancamentos: Lancamento[] }`.
  Lancamento: `{ id, profissional_id, reserva_id, consultorio_id, data_referencia, valor_cobrado, vencimento, situacao, situacao_efetiva, valor_pago, saldo, nome_profissional, nome_consultorio, observacoes, pagamentos: [{id,valor,data_pagamento,forma,referencia}] }`.
- `POST /api/admin/lancamentos` `{ profissional_id, consultorio_id, data_referencia, valor, vencimento?, observacoes?, reserva_id? }`.
- `PUT /api/admin/lancamentos/[id]` `{ valor?, vencimento?, situacao?, observacoes? }` (cancelamento via situacao:"cancelado"; 400 se marcar pago com saldo).
- `POST /api/admin/lancamentos/[id]/pagamentos` `{ valor, data_pagamento?, forma, referencia? }` → pagamento parcial; 400 se > saldo.
- `DELETE /api/admin/lancamentos/[id]/pagamentos?pagamento_id=N` → estorna.

### Relatórios
- `GET /api/admin/relatorios?de&ate` → `{ periodo, ocupacao[{consultorio,horas_disponiveis,horas_ocupadas,percentual}], total_horas_ocupadas, por_dia_semana[], por_tipo[], financeiro{prevista,recebida,pendente,atrasado,por_consultorio[],por_profissional[]}, lancamentos[] }`.
- Exportação CSV: `GET /api/admin/relatorios/exportar?conjunto=lancamentos|ocupacao&de&ate&profissional_id&consultorio_id&situacao` → download (usar `<a href>` ou `window.open` com os mesmos filtros).

### Auditoria
- `GET /api/admin/auditoria?limite=100` → `{ eventos: [{id, admin, acao, entidade, entidade_id, resumo, quando}] }`.

## Regras que as telas devem refletir

1. Domíngos bloqueados; blocos exatos de 1h em hora cheia (07–21).
2. Recorrência bloqueia todas as ocorrências da vigência; avulsa/reposição bloqueiam só a data.
3. Cancelar 1 ocorrência de fixo = exceção (não encerra a série).
4. Solicitação ≠ reserva; confirmação sempre pelo servidor (revalidar).
5. Público nunca vê nomes, telefones, valores individuais ou financeiro.
6. Estados de interface: carregando, vazio, erro de conexão, erro ao salvar, 409 conflito, sucesso — todos explícitos.
7. Acessibilidade: labels nos inputs, `aria-*`, foco visível (já global), contraste, navegação por teclado.
8. Responsividade: agenda em celular sem rolagem horizontal excessiva (troca de dia/consultório).
