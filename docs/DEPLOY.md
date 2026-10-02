# Publicação — Oracle Cloud Always Free (grátis para sempre)

Este guia publica o HumanaMentePsi com **URL pública permanente** (qualquer pessoa
abre a agenda pelo celular ou computador), usando o plano **Always Free** da Oracle
Cloud: uma VM Linux com disco persistente, dentro dos limites gratuitos.

**Por que aqui?** O sistema usa SQLite (arquivo em `data/`). Hospedagens grátis
convencionais (Render free, Vercel…) apagam os arquivos a cada deploy/reinício —
a agenda e os cadastros zerariam. A VM da Oracle tem disco que **persiste** e roda
o projeto **exatamente como está**, sem mudar código.

> Custo: R$ 0 (a Oracle pede cartão apenas para verificar identidade — não cobra).
> Conta e instância devem ser mantidas dentro das regras Always Free da Oracle.

---

## Passo 1 — Criar a conta Oracle Cloud

1. Acesse <https://www.oracle.com/cloud/free/> e clique em **Start for Free**.
2. Preencha e **confirme o e-mail**.
3. País/region: escolha **Brazil** e a home region **São Paulo (sa-vinhedo-1)** —
   menor latência para o Rio. (Se o shape grátis não aparecer lá, crie em
   `us-ashburn-1` ou `us-phoenix-1`, que têm mais disponibilidade.)
4. Cartão de crédito: usado só na verificação de identidade. **Não há cobrança**
   enquanto você usar os recursos Always Free.

## Passo 2 — Gerar a chave SSH no seu computador

Abra o PowerShell e rode:

```powershell
mkdir "$env:USERPROFILE\.ssh" -Force | Out-Null
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\hmps_oracle"
```

Quando ele pedir a **passphrase**, aperte **Enter duas vezes** (deixe vazio).
Isso cria dois arquivos. Você vai **carregar o `.pub`** na Oracle (Passo 3) e usar
o outro para conectar (Passo 5). Para ver/conferir o conteúdo público:

```powershell
notepad "$env:USERPROFILE\.ssh\hmps_oracle.pub"
```

## Passo 3 — Criar a instância (VM)

1. Menu **Compute → Instances → Create Instance**.
2. **Name:** `hmps`
3. **Image:** busque e escolha **Canonical Ubuntu 24.04** (versão aarch64/ARM, se aparecer).
4. **Shape:** *Change shape →* **VM.Standard.A1.Flex** (Always Free eligible) com
   **1 OCPU e 6 GB de RAM** (é gratuito; pode ir até 4 OCPU/24 GB no total).
   - Se o A1 não estiver disponível na região, tente outra região ou o shape
     `VM.Standard.E2.1.Micro` (adicione swap — ver Problemas comuns).
5. **Add SSH keys → Upload public key** → cole o conteúdo de `hmps_oracle.pub`
   (abra com o Bloco de Notas e copie tudo) ou use o seletor de arquivo.
6. **Boot volume:** 50 GB (grátis, o limite é 200 GB).
7. **Create** e aguarde a instância ficar *Running*. Anote o **IP público**.

## Passo 4 — Liberar as portas 80 e 443

Na instância: **Networking → Virtual Cloud Network → (a VCN) → Security Lists →
Default Security List → Add Ingress Rules**:

| Source | Destination Port | Protocol |
| --- | --- | --- |
| 0.0.0.0/0 | 80 | TCP |
| 0.0.0.0/0 | 443 | TCP |

(Sem isso o navegador não alcança o nginx — a causa nº 1 de "site não abre".)

## Passo 5 — Conectar na VM

```powershell
ssh -i "$env:USERPROFILE\.ssh\hmps_oracle" ubuntu@SEU_IP_PUBLICO
```

Responda `yes` na primeira vez.

## Passo 6 — Instalar tudo (um comando)

Dentro da VM:

```bash
curl -fsSL https://raw.githubusercontent.com/eloycfb-max/AgendaPsi/main/deploy/oracle/setup-oracle.sh -o setup.sh
sudo bash setup.sh
```

O script (idempotente — rode de novo sempre que precisar atualizar):

- instala Node.js 24, nginx, PM2 e o firewall local;
- clona este repositório em `/opt/hmps`;
- **gera e imprime a senha do painel** (guarde!); cria o `.env` sozinho;
- faz o build de produção e sobe o site no PM2 (reinício automático ao ligar a VM);
- configura o nginx (porta 80 → app) e o **backup diário às 03h**
  (banco via `VACUUM INTO` + fotos, mantendo 14 dias em `/var/backups/hmps`).

No final ele imprime os endereços:

```
Site:    http://SEU_IP/
Agenda:  http://SEU_IP/agenda
Painel:  http://SEU_IP/login
E-mail:  admin@humamentepsi.com
Senha:   ***************   (guarde!)
```

## Passo 7 — Testar

1. Abra `http://SEU_IP/agenda` — a grade deve carregar com os horários.
2. Entre no painel com `admin@humamentepsi.com` + senha gerada.
3. Peça para outra pessoa (celular, outra rede) abrir o mesmo link.

> ⚠️ **Não rode `npm run test:smoke` no servidor** — o teste cria e apaga dados
> de demonstração. Ele é para uso local (ver README §9).

---

## Opcional — domínio próprio e HTTPS

1. Aponte um domínio (A record) para o IP da VM no seu registrador.
2. Na VM:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d agenda.seudominio.com
```

O certificado é renovado sozinho. Depois o link vira `https://…` (importante se
o site for usado fora de redes de confiança).

## Backups e restauração

- **Automático:** cron às 03h → `/var/backups/hmps/agenda-AAAA-MM-DD.db` (+ fotos).
  Baixa os arquivos periodicamente para o seu computador.
- **Restaurar:** pare o app, substitua `data/agenda.db` pelo backup, suba de novo:

```bash
sudo -u hmps env HOME=/home/hmps bash -lc 'cd /opt/hmps && pm2 stop agenda'
# (substituir o arquivo, por scp ou dentro da VM)
sudo -u hmps env HOME=/home/hmps bash -lc 'cd /opt/hmps && pm2 start agenda && pm2 save'
```

## Atualizar o sistema após um push no GitHub

```bash
sudo -u hmps env HOME=/home/hmps bash -lc 'cd /opt/hmps && git pull && npm ci && npm run build && pm2 restart agenda'
```

Se o build falhar, o `&&` interrompe o comando e a **versão antiga continua no ar**.

## Problemas comuns

| Sintoma | Causa / solução |
| --- | --- |
| "Site não pode ser acessado" / timeout | Portas 80/443 fechadas na Security List (Passo 4) |
| IP parou de funcionar | O IP público é efêmero: ao **parar e iniciar** a instância ele pode mudar — atualize no console da Oracle. Mantenha a instância ligada (é grátis). |
| `node -v` menor que 24 | Rode o `setup.sh` de novo (ele corrige) |
| Build falhou por memória | Aumente a RAM da shape (A1 flexível) ou adicione swap: `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Quer ver o que está acontecendo | `sudo -u hmps env HOME=/home/hmps bash -lc 'pm2 logs agenda --lines 50'` e `sudo tail -f /var/log/hmps-backup.log` |
| Esqueci a senha do painel | Ela é definida no **primeiro boot** (`.env` da VM). Se perdida, me avise — gero o comando de redefinição sem perder os dados. |
