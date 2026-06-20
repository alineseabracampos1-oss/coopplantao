# 🏥 CoopPlantão

> Sistema de gestão de plantões médicos para cooperativas  
> Piloto: **CEMERGE** — Cooperativa de Médicos Emergencistas do Ceará

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 5 |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| Notificações | Evolution API (WhatsApp) via Edge Function |
| Deploy | Netlify (CI/CD via GitHub Actions) |
| Auth cooperado | Magic Link por WhatsApp (CRM + CPF → token) |

---

## Estrutura do projeto

```
coopplantao/
├── src/
│   ├── main.jsx              # Entry point React
│   ├── CoopPlantao.jsx       # Componente raiz + camada db
│   └── lib/
│       └── supabase.js       # Cliente Supabase (referência)
├── supabase/
│   └── functions/
│       ├── sync-cooperados/  # Edge: importa base da cooperativa
│       └── notificar-whatsapp/ # Edge: envia WhatsApp + gera magic link
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD: lint → build → deploy
├── index.html
├── vite.config.js
├── netlify.toml
├── .env.example
└── README.md
```

---

## Setup local

```bash
# 1. Clonar
git clone https://github.com/SEU_USER/coopplantao.git
cd coopplantao

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais Supabase

# 4. Rodar em desenvolvimento
npm run dev
# → http://localhost:5173
```

---

## Ativar Supabase real

No `src/CoopPlantao.jsx`, linha 11:
```js
const USE_SUPABASE = true; // ← trocar de false para true
```

---

## Deploy via GitHub Actions

### 1. Criar repositório no GitHub
```bash
git init
git add .
git commit -m "feat: CoopPlantão MVP inicial"
git remote add origin https://github.com/SEU_USER/coopplantao.git
git push -u origin main
```

### 2. Criar site no Netlify
- Netlify Dashboard → **Add new site → Import an existing project**
- Conectar ao repositório GitHub
- Build command: `npm run build`
- Publish directory: `dist`

### 3. Configurar secrets no GitHub
`Repositório → Settings → Secrets and variables → Actions → New secret`

| Secret | Onde encontrar |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User Settings → Applications → New access token |
| `NETLIFY_SITE_ID` | Netlify → Site Settings → General → Site ID |
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `VITE_COOPERATIVA_SIGLA` | `CEMERGE` |
| `VITE_APP_URL` | `https://plantoes.cemerge.coop.br` |

### 4. Fluxo de deploy automático
```
git push origin main      → build + deploy em produção
git push origin develop   → deploy de preview (URL temporária)
Abrir Pull Request        → deploy de preview + comentário automático no PR
```

---

## Deploy das Edge Functions (Supabase)

```bash
# Instalar CLI
npm install -g supabase

# Login e link
supabase login
supabase link --project-ref XXXXXXXX

# Deploy das functions
supabase functions deploy sync-cooperados
supabase functions deploy notificar-whatsapp

# Configurar secrets das edge functions
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set EVOLUTION_API_URL=https://evo.cemerge.coop.br
supabase secrets set EVOLUTION_API_KEY=sua-chave
supabase secrets set EVOLUTION_INSTANCE=cemerge
supabase secrets set APP_BASE_URL=https://plantoes.cemerge.coop.br
```

---

## Banco de dados

Executar os scripts SQL no Supabase Dashboard → SQL Editor:
1. `coopplantao_supabase.sql` — schema completo (tabelas, RLS, triggers, funções)
2. `coopplantao_magic_tokens.sql` — tabela de tokens e funções de autenticação

---

## Variáveis de ambiente

| Variável | Descrição | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Chave anon pública do Supabase | ✅ |
| `VITE_COOPERATIVA_SIGLA` | Sigla da cooperativa (ex: CEMERGE) | ✅ |
| `VITE_APP_URL` | URL pública do app (para magic links) | ✅ |
| `VITE_APP_ENV` | `development` \| `production` \| `preview` | — |

---

## Funcionalidades

### Painel da Cooperativa (admin)
- [x] Dashboard com métricas de vagas e candidaturas
- [x] Publicação de vagas por hospital + especialidade + turno
- [x] Visualização e aprovação de candidatos
- [x] Gestão da base de cooperados (ativo/inativo)
- [x] Sincronização com API externa da cooperativa
- [x] Disparo de notificações WhatsApp por vaga
- [x] Histórico de envios com logs

### App do Cooperado (mobile-first)
- [x] Login por CRM + CPF
- [x] Acesso via magic link no WhatsApp (sem digitar nada)
- [x] Feed de plantões filtrado pela especialidade do cooperado
- [x] Candidatura com 1 toque
- [x] Agenda pessoal com status (aguardando / confirmado)
- [x] Projeção financeira do mês

### Infraestrutura
- [x] RLS no Supabase (dados isolados por cooperativa)
- [x] Realtime (novas vagas e candidaturas sem reload)
- [x] Magic tokens com expiração de 24h e uso único
- [x] Limpeza automática via pg_cron
- [x] CI/CD via GitHub Actions
- [x] Headers de segurança no Netlify

---

*CoopPlantão MVP · Fortaleza-CE · 2026*
