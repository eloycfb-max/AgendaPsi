# PRD — Resumo funcional do sistema HumanaMentePsi

> Este documento resume a especificação funcional completa (versão 1.0) usada como
> base do desenvolvimento. Mantém os IDs de requisitos (RF/RNF/CA) para rastreio.
> O PRD original completo foi fornecido pelo responsável (Eloy Bezerra).

**Produto:** sistema web responsivo de agendamento, gestão de salas e controle financeiro.
**Estabelecimento:** HumanaMentePsi — Avenida das Américas, 1155, Barra da Tijuca, RJ.
**Contato:** WhatsApp +55 21 98754-0264 · **Moeda:** BRL · **Fuso:** America/Sao_Paulo.

## 1. Escopo

| ID | Módulo | Entrega |
| -- | ------ | ------- |
| MOD-01 | Site público | Institucional, diferenciais, contato, localização |
| MOD-02 | Agenda | Consulta da disponibilidade dos 3 consultórios |
| MOD-03 | Reservas | Fixas (recorrentes), avulsas e reposições |
| MOD-04 | WhatsApp | Solicitação com mensagem pré-preenchida |
| MOD-05 | Administração | Painel privado autenticado |
| MOD-06 | Profissionais | Cadastro dos sublocatários |
| MOD-07 | Financeiro | Lançamentos, pagamentos parciais, pendências |
| MOD-08 | Consultórios | Fotos, descrições, recursos e preços |
| MOD-09 | Relatórios | Ocupação e receita + exportação CSV |
| MOD-10 | Segurança | Autenticação, autorização no servidor, auditoria |
| MOD-11 | Compartilhamento | Link público permanente da agenda |

**Fora do escopo (v1):** prontuário/pacientes, agenda clínica, convênios, NF-e,
pagamento automático, contratos eletrônicos, app nativo, Google Calendar, folha de pagamento.

## 2. Perfis

- **Visitante:** consulta agenda/preços/fotos, filtra, copia link, solicita pelo WhatsApp. Não escreve nada, não vê nomes, valores individuais nem dados financeiros.
- **Administrador (Eloy Bezerra):** acesso total; primeira versão com um único admin (estrutura permite mais).
- **Profissional cadastrado:** registro sem conta de acesso na v1; futuramente, acesso restrito aos próprios dados.

## 3. Requisitos-chave por módulo

### Agenda (RF-006 a RF-016)
- Exatamente 3 consultórios (01/02/03); segunda a sábado, 07h–21h; blocos de 1h; último 20h–21h; domingo bloqueado.
- Visualização semanal + individual; navegação de semanas; filtros por consultório, tipo e disponibilidade.
- Atualização compartilhada sem recarregar; público vê apenas livre/ocupado.

### Reservas (RF-017 a RF-026)
- **Fixo:** recorrência semanal com vigência (data final opcional), bloqueia todas as ocorrências, encerramento datado e exceções pontuais (liberar ocorrência).
- **Avulso:** pontual, não repete.
- **Reposição:** pontual com observação, não gera ocorrências.

### Cores (RF-027)
Fixo = azul-petróleo · Avulso = verde · Reposição = laranja · Disponível = cinza/branco · Pendente = amarelo. Contraste suficiente + rótulo textual (não depender só de cor).

### Profissionais (RF-028 a RF-032)
Cadastro/editar; inativo não recebe reservas mas mantém histórico; exclusão física bloqueada quando houver reservas/financeiro (usar inativação); histórico consultável.

### WhatsApp (RF-033 a RF-039)
Seleção de horário → mensagem com nome, consultório, data, dia, horário e tipo → destino 55 21 98754-0264. **Abrir o WhatsApp não confirma reserva.** Solicitações registradas como pendentes; confirmação manual com **revalidação** de disponibilidade; conflito bloqueia com aviso.

### Administração (RF-040 a RF-045)
Login obrigatório; visão geral (reservas do dia, próximas, solicitações pendentes, fixos ativos, valores pendentes, receita do mês); gestão da agenda, consultórios e profissionais; histórico de operações.

### Financeiro (RF-046 a RF-053)
Lançamento com profissional, consultório, tipo, data, cobrado, recebido, saldo, vencimento, data pagamento, forma, situação, observações. Pagamentos parciais; situações pendente/pago/parcial/atraso/cancelado; indicadores (prevista, recebida, pendente, atraso, por consultório e tipo); filtros; exportação CSV/Excel; **reserva confirmada ≠ pagamento recebido**.

### Consultórios (RF-054 a RF-058)
Cadastro com descrição/recursos/fotos/preço; galeria (incluir, substituir, ordenar, excluir); preços por sala e modalidade; ausente = "Consulte o valor"; valor acordado preservado historicamente.

## 4. Regras de negócio

- Bloco de 1 hora em hora cheia; exemplos válidos 07h–08h … 20h–21h.
- Nunca duas reservas ativas conflitantes no mesmo consultório/data/hora (validação transacional no servidor/banco — não só frontend).
- Recorrência valida conflitos contra reservas pontuais e outras recorrências na vigência; ocorrências calculadas sob demanda com exceções (não materializar milhares de linhas).
- Cancelar avulso libera só aquela; cancelar 1 ocorrência de fixo não encerra a série, salvo escolha explícita; histórico preservado.
- Solicitação pendente nunca é reserva; bloqueio temporário (se existir) é configurável e expira.
- **Saldo = valor cobrado − pagamentos válidos**; sem valor negativo nem pagamento duplicado; receita recebida considera pagamentos registrados; atraso = vencimento + saldo.

## 5. Interfaces e estados

Paleta: azul-petróleo (identidade/fixo), verde-sálvia (avulso), laranja (reposição), branco/cinza (fundo/livre), neutros (texto). Responsivo (desktop/tablet/Android/iPhone); mobile com visão compacta sem rolagem horizontal excessiva. Acessibilidade: legibilidade, contraste, teclado, campos obrigatórios identificados, erros compreendidos, estados não só por cor.
Estados previstos: carregando, agenda vazia, nenhum horário livre, falha de conexão, falha ao salvar, horário ocupado por outro processo, solicitação enviada, reserva confirmada/cancelada, sessão expirada — **sem sucesso antes da confirmação do servidor**.

## 6. Segurança e LGPD

Autenticação segura (senha protegida, recuperação, logout, limite de tentativas quando suportável); autorização verificada **no servidor e no banco** (esconder botões não basta); área pública sem escrita sobre reservas/profissionais/pagamentos/configurações; nunca expor nomes de profissionais, contatos, observações, valores individuais, financeiro ou auditoria ao público. LGPD (Lei 13.709/2018): coleta mínima, finalidade informada, acesso restrito, retenção/descarte definidos, dados protegidos, canal do responsável, sem dados de pacientes.

## 7. Requisitos não funcionais

RNF-001 responsividade · 002 disponibilidade · 003 consistência de conflitos · 004 sincronização · 005 segurança no servidor · 006 privacidade · 007 desempenho (meta: agenda em até 2 s) · 008 acessibilidade · 009 manutenção/documentação · 010 backup/restauração · 011 auditoria · 012 datas e valores no padrão brasileiro.

## 8. Critérios de aceitação (teste antes de publicar)

- **CA-001** só blocos válidos 07–21 seg–sáb · **CA-002** domingo bloqueado · **CA-003** fixo ocupa todas as segundas da vigência · **CA-004** avulso não repete · **CA-005** reposição bloqueia só a data · **CA-006** duas confirmações simultâneas → 1 reserva · **CA-007** público sem nomes/telefones/valores · **CA-008** WhatsApp com mensagem correta · **CA-009** 200 − 100 = saldo 100 · **CA-010** preço da sala não altera valor acordado · **CA-011** operação admin sem auth → servidor nega · **CA-012** alterações propagam sem reload · **CA-013** cancelar 1 ocorrência mantém as demais · **CA-014** CSV só com registros filtrados.

## 9. Fases

1. **MVP:** site, 3 consultórios, agenda, reservas (fixa/avulsa/reposição), painel, profissionais, auth, sincronização, link público, WhatsApp, anti-conflito.
2. **Financeiro e apresentação:** preços, fotos, lançamentos, pagamentos, pendências, relatórios, exportação, indicadores de ocupação.
3. **Futuro:** notificações, WhatsApp API, contas de profissionais, contratos, calendário externo, relatórios avançados — sem atrasar o MVP.

## 10. Publicação somente com

Login seguro ✔ · 3 consultórios ✔ · grade correta ✔ · 3 modalidades ✔ · recorrência ✔ · conflitos no backend ✔ · agenda pública sem dados privados ✔ · WhatsApp correto ✔ · financeiro com saldos corretos ✔ · fotos e preços administráveis ✔ · link público ✔ · testes críticos ✔ · backup documentado ✔ · política de privacidade ✔.
