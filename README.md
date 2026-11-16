# ProspectFlow / Kaizen CRM

Sistema privado de gestão interna da agência **Kaizen** (uso exclusivo de administrador único: Ian), construído com **React 19, TypeScript, Vite, Tailwind CSS v4, Express, Cloud Firestore, Firebase Authentication** e **Google Gemini** (via rotas autenticadas no servidor).

---

## Arquitetura Atual

- **Frontend (SPA):** `src/` — Kanban de prospecção, Agenda (reuniões e retornos), Dashboard, Scripts customizáveis, Importador de planilhas (`xlsx` local), Visão Global e Backup JSON v3.0.
- **Autenticação Privada (Fail-Closed):** Firebase Authentication (E-mail e Senha) para **usuário único administrador**, sem cadastro público. Exige simultaneamente usuário autenticado, `VITE_AUTHORIZED_ADMIN_UID` configurado e correspondência exata do UID (sem fallback permissivo).
- **Banco de Dados:** Cloud Firestore nomeado (`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea` no projeto `gen-lang-client-0798002034`), estruturado em:
  - `/workspaces/adm_equipeie/leads/{leadId}`
  - `/workspaces/adm_equipeie/niches/{nicheId}`
  - `/workspaces/adm_equipeie/importedSheets/{sheetId}`
  - Espelho local em `localStorage` para carregamento rápido.
- **Backend / Serverless (`api/index.ts` e `server.ts`):** Express com `/api/health` e rotas protegidas `/api/gemini/*` exigindo token Bearer do Firebase Auth, `FIREBASE_PROJECT_ID`, `AUTHORIZED_ADMIN_UID` obrigatório, rate limiting e sanitização de payload.

---

## Executando Localmente

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Configure o arquivo `.env` a partir de `.env.example`:**
   - Preencha **obrigatoriamente** `FIREBASE_PROJECT_ID`, `AUTHORIZED_ADMIN_UID` e `VITE_AUTHORIZED_ADMIN_UID` com o UID real do administrador criado no Firebase Authentication. Sem essas configurações, o acesso ao sistema e às rotas `/api/gemini/*` é bloqueado por segurança.
   - Informe `GEMINI_API_KEY` no servidor (opcional — se ausente, o restante do CRM opera normalmente).
3. **Inicie o servidor de desenvolvimento (porta 3000):**
   ```bash
   npm run dev
   ```

---

## Comandos Disponíveis

- `npm run dev`: Servidor full-stack local (Express + Vite) na porta 3000.
- `npm run build`: Gera o build de produção em `dist/`.
- `npm run lint`: Verifica tipos TypeScript (`tsc --noEmit`).
- `npm test`: Executa os testes unitários, de backup recursivo, autorização e segurança da API.
- `npm run test:rules`: Executa `firestore.rules.test.ts` contra Auth + Firestore Emulators (requer Java/JRE e falha explicitamente se o Emulator estiver inativo).
- `npm run rules:check`: Verifica se `firestore.rules` ainda contém placeholder de UID antes de deploy.
- `npm run rules:configure`: Aplica `AUTHORIZED_ADMIN_UID` localmente em `firestore.rules` (requer `--write` explícito e não publica em produção).
- `npm run backup:firestore`: Executa backup recursivo somente-leitura completo do Firestore com validação pós-gravação (requer Service Account somente-leitura via `GOOGLE_APPLICATION_CREDENTIALS`).

---

## Documentação Complementar

- `docs/ARQUITETURA_KAIZEN.md`: Convenções de evolução incremental, modelo de dados e compatibilidade retroativa.
- `docs/BACKUP_E_AMBIENTES.md`: Estratégia de backup recursivo, validação e isolamento Desenvolvimento / Testes / Produção (Vercel + Firebase).
- `security_spec.md` e `firestore.rules`: Regras de segurança endurecidas para usuário único e vetores de ataque testados.
