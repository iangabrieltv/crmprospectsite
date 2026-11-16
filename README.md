# ProspectFlow / Kaizen CRM

Sistema privado de gestão interna da agência **Kaizen**, construído com **React 19, TypeScript, Vite, Tailwind CSS v4, Express, Cloud Firestore, Firebase Authentication** e **Google Gemini** (via rotas autenticadas no servidor).

---

## Arquitetura Atual

- **Frontend (SPA):** `src/` — Kanban de prospecção, Agenda (reuniões e retornos), Dashboard, Scripts customizáveis, Importador de planilhas (`xlsx` local), Visão Global e Backup JSON v3.0.
- **Autenticação Privada:** Firebase Authentication (E-mail e Senha) para **usuário único administrador**, sem cadastro público, com bloqueio opcional por UID (`VITE_AUTHORIZED_ADMIN_UID`).
- **Banco de Dados:** Cloud Firestore nomeado (`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea` no projeto `gen-lang-client-0798002034`), estruturado em:
  - `/workspaces/adm_equipeie/leads/{leadId}`
  - `/workspaces/adm_equipeie/niches/{nicheId}`
  - `/workspaces/adm_equipeie/importedSheets/{sheetId}`
  - Espelho local em `localStorage` para carregamento rápido.
- **Backend / Serverless (`api/index.ts` e `server.ts`):** Express com `/api/health` e rotas protegidas `/api/gemini/*` exigindo token Bearer do Firebase Auth, rate limiting e validação de payload.

---

## Executando Localmente

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Configure o arquivo `.env` a partir de `.env.example`:**
   - Informe `GEMINI_API_KEY` no servidor (opcional — se ausente, o restante do CRM opera normalmente).
   - Para restringir backend e frontend exatamente ao seu UID após criar sua conta no Firebase Auth, preencha `AUTHORIZED_ADMIN_UID` e `VITE_AUTHORIZED_ADMIN_UID`.
3. **Inicie o servidor de desenvolvimento (porta 3000):**
   ```bash
   npm run dev
   ```

---

## Comandos Disponíveis

- `npm run dev`: Servidor full-stack local (Express + Vite) na porta 3000.
- `npm run build`: Gera o build de produção em `dist/`.
- `npm run lint`: Verifica tipos TypeScript (`tsc --noEmit`).
- `npm test`: Executa os testes unitários e de segurança da API.
- `npm run test:rules`: Executa `firestore.rules.test.ts` (requer Firebase Auth + Firestore Emulators rodando).
- `npm run backup:firestore`: Executa backup somente-leitura completo do Firestore (requer credencial Service Account via `GOOGLE_APPLICATION_CREDENTIALS`).

---

## Documentação Complementar

- `docs/ARQUITETURA_KAIZEN.md`: Convenções de evolução incremental, modelo de dados e compatibilidade retroativa.
- `docs/BACKUP_E_AMBIENTES.md`: Estratégia completa de backup (Cloud Storage, CLI e app v3.0), automação futura e isolamento Desenvolvimento vs. Produção (Vercel + Firebase).
- `security_spec.md` e `DRAFT_firestore.rules`: Regras de segurança propostas para usuário único (aguardando validação com seu UID antes de publicar em produção).
