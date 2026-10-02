# HumanaMentePsi — Sistema de Agendamento e Gestão de Sublocação

Sistema web responsivo de consulta de disponibilidade, gestão de reservas e controle financeiro dos três consultórios do **HumanaMentePsi** — Avenida das Américas, 1155, Barra da Tijuca, Rio de Janeiro/RJ.

- **Público:** site institucional + agenda semanal compartilhada + solicitação de horários pelo WhatsApp.
- **Administrativo:** painel privado (login) com reservas fixas/avulsas/reposições, profissionais, consultórios, fotos, preços, solicitações, financeiro, relatórios e auditoria.

Resumo da especificação: [`docs/PRD.md`](docs/PRD.md) · Contrato de API: [`docs/API.md`](docs/API.md)

---

## 1. Requisitos

| Item | Versão |
| ---- | ------ |
| Node.js | **24.x ou superior** (usa `node:sqlite` nativo) |
| npm | 11+ |
| Banco de dados | SQLite local (criado automaticamente em `data/agenda.db`) |
| Serviços externos | Nenhum obrigatório. WhatsApp via link oficial `wa.me` |

## 2. Como executar

```powershell
npm install          # dependências
npm run dev          # desenvolvimento → http://localhost:3000
npm run build        # produção
npm run start        # servidor de produção
npm run test:smoke   # 37 verificações de aceitação (servidor ligado em :3000)
```

Na primeira execução o banco é criado e semeado automaticamente:
3 consultórios (Consultório 01/02/03) e o administrador principal.

> 💡 **Problema conhecido:** se você rodou `npm run build` e depois `npm run dev`
> e as rotas da API começarem a responder 404, apague a pasta `.next` e inicie
> o dev novamente (`Remove-Item -Recurse .next`). O build de produção e o
> compilador de desenvolvimento dividem a pasta `.next` e o manifesto de rotas
> pode ficar incompleto. O smoke test limpa automaticamente os dados que cria
> (no início e no fim da execução), deixando o banco pronto para uso real.

## 3. Credenciais iniciais

| Campo | Valor |
| ----- | ----- |
| URL administrativa | `/login` |
| E-mail | `admin@humamentepsi.com` |
| Senha | definida no primeiro boot pela variável `ADMIN_SENHA_INICIAL` |

> ⚠️ **Defina `ADMIN_SENHA_INICIAL` antes da primeira execução** para semear o painel com a senha desejada — não use a senha padrão do seed em produção. Se o banco já foi criado sem a variável, troque a senha manualmente ou apague `data/agenda.db` para recriar. A sessão expira em 8 horas.

## 4. Estrutura

```
src/
  app/
    (site)/            # site público: início, consultórios, agenda, diferenciais,
                       # contato, política de privacidade
    login/             # tela de autenticação
    admin/             # painel: dashboard, agenda, profissionais, consultórios,
                       # solicitações, financeiro, relatórios, auditoria
    api/               # rotas REST (públicas e administrativas)
  components/          # Modal, Indicador, SiteHeader, SiteFooter
  lib/                 # db (schema+seed), auth (sessão JWT), schedule (conflitos),
                       # finance (saldo), dates (fuso SP), whatsapp, audit
data/                  # criado em runtime: agenda.db, secret.key, uploads/
docs/                  # PRD e contrato de API
```

## 5. Regras centrais implementadas

- **Grade:** segunda a sábado, 07h–21h, blocos de 1 hora em hora cheia; domingo bloqueado.
- **Unicidade:** índice único no banco `(consultório, data, hora)` para reservas ativas + verificação transacional contra recorrências (dois dispositivos simultâneos → só uma confirmação é aceita).
- **Recorrência:** entidade única com vigência; ocorrências calculadas sob demanda; exceções liberam ocorrências pontuais sem encerrar a série.
- **Privacidade pública:** a agenda pública retorna apenas `livre`/`ocupado` — nunca nomes, telefones ou valores.
- **Solicitação ≠ reserva:** o visitante registra a solicitação (status pendente) e o WhatsApp é aberto com mensagem pronta; a confirmação é manual e **revalida** a disponibilidade no servidor.
- **Financeiro:** saldo = valor cobrado − somatório de pagamentos; pagamentos parciais; impedimento de pagamento acima do saldo; situação efetiva (pendente/pago/parcial/atraso/cancelado) derivada; valor acordado preservado na reserva mesmo com mudança de preço da sala.
- **Auditoria:** operações administrativas relevantes registradas com data/hora e resumo.

## 6. Backup e recuperação

O banco SQLite e as fotos ficam em `data/`. Para backup:

```powershell
# Parar o servidor e copiar a pasta inteira:
Copy-Item -Recurse .\data .\backup\data_$(Get-Date -Format yyyyMMdd)
```

Alternativa com o servidor ligado (modo WAL): usar `VACUUM INTO`:

```powershell
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/agenda.db');db.exec(\"VACUUM INTO 'data/backup_$(Get-Date -Format yyyyMMdd).db'\")"
```

**Restauração:** parar o servidor, substituir `data/agenda.db` (e `data/uploads/`) pelos arquivos do backup e reiniciar. Verificar o login após restaurar.

Frequência recomendada: diária ou semanal, conforme a criticidade — documentar a rotina junto com o plano de hospedagem.

## 7. Publicação

> 🚀 **Guia completo e gratuito (Oracle Cloud Always Free, passo a passo):**
> [`docs/DEPLOY.md`](docs/DEPLOY.md) — publica o site com URL permanente,
> backup automático e HTTPS opcional, sem mudar código.

1. `npm run build && npm run start` em hospedagem com Node 24+ (VPS, Render, Railway, Fly.io etc.).
2. Definir variáveis: `ADMIN_SENHA_INICIAL` (apenas no primeiro boot) e, opcionalmente, `NODE_ENV=production`.
3. URL pública permanente = endereço do site; URL administrativa = `/login`.
4. Copiar o link da agenda (botão "Copiar link" no topo) para divulgação.
5. Persistir a pasta `data/` em volume permanente (o banco vive lá).

## 8. Serviços externos e custos

| Serviço | Uso | Custo |
| ------- | --- | ----- |
| Hospedagem Node.js | Aplicação e banco SQLite | conforme plano contratado |
| WhatsApp (link oficial wa.me) | Canal de solicitação | Gratuito |
| Google Maps (link) | Localização | Gratuito |

Nenhuma API paga é necessária na primeira versão.

## 9. Testes antes de publicar

Checklist mapeado aos critérios de aceitação do PRD (CA-001 a CA-014): horários válidos, domingo bloqueado, ocorrências de recorrência, avulsa não repete, reposição pontual, conflito simultâneo (dois dispositivos), privacidade pública, mensagem do WhatsApp, saldo financeiro (ex.: 200 − 100 = 100), preço histórico, autorização (chamada sem login → 401), sincronização por polling, cancelamento de ocorrência isolada e exportação CSV respeitando filtros.

Ver também `docs/PRD.md` seções 12 e 13 (critérios de aceitação e plano de testes).
