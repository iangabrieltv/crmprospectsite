# Arquitetura e Preparação para Expansão — Kaizen (Etapas 0–4)

Este documento define as convenções técnicas adotadas para evoluir o ProspectFlow CRM no sistema interno completo da agência Kaizen **sem quebrar nem migrar destrutivamente os dados já existentes**.

---

## 1. Estrutura Modular Atual e Evolução Incremental

```text
src/
├── config/
│   ├── env.ts                # Resolução de variáveis por ambiente (prod/staging/emulator)
│   └── navigation.ts         # Estrutura 6 grupos / 16 módulos (12 implementados até Etapa 4)
├── services/
│   ├── authService.ts        # Sessão Firebase Auth (usuário único) + obtenção de ID token
│   ├── backupService.ts      # Backup v3.0 (16 coleções incluindo Financeiro), checksum e restauração
│   ├── clientService.ts      # Deduplicação, conversão Lead -> Client sem perda de notas e resumo da carteira
│   ├── proposalService.ts    # Códigos sequenciais, totais, transições de status e geração de resumo WhatsApp
│   ├── pdfService.ts         # Geração client-side de PDF A4 (jspdf) para Propostas, Contratos e Relatórios Financeiros sem window.open
│   ├── projectService.ts     # Modelos independentes (Kaizen Start, Kaizen Performance 90d, Personalizado), progresso por tarefas e histórico
│   ├── taskService.ts        # Fonte única de tarefas, 6 filas operacionais, filtros e sumário
│   ├── agendaService.ts      # Feed integrado sem duplicação (AgendaEvent + Project + Task + Lead) e preparo OAuth Google Calendar
│   ├── socialService.ts      # Validação de escopo social contratado por cliente e bloqueio de auto-publicação
│   └── finance/              # Domínio financeiro completo (money em centavos, entriesService, transactionsService, cashFlowService, recurrencesService, categoriesService, auditService, integrationsService, reportsService)
├── types/
│   ├── crm.ts                # Entidades base (Lead, NicheCampaign, ImportedSheet)
│   ├── kaizen.ts             # Entidades Etapas 2 e 3 (Client, ProposalContract, Project, Task, AgendaEvent, SocialChannel, SocialPost)
│   └── finance.ts            # Entidades Etapa 4 (FinancialEntry, FinancialTransaction, FinancialCategory, FinancialRecurrence, FinancialSettings, FinancialAuditLog)
├── utils/
│   ├── firebase.ts           # Conexão Firestore nomeado, listeners onSnapshot e gravações com schemaVersion/updatedAt
│   ├── storage.ts            # Cache localStorage seguro para todas as coleções locais
│   ├── dashboardMetrics.ts   # Agregação real de KPIs (Clientes, Propostas e Receita Realizada/A Receber em centavos)
│   ├── phone.ts              # Normalização E.164, saudações e links wa.me
│   └── initialData.ts        # Campanha padrão limpa (sem dados fictícios de leads)
├── api/
│   ├── securityMiddleware.ts # Verificação Bearer JWT Firebase, trava por UID único, rate limit e headers
│   └── routes.ts             # Rotas Express (/api/health e /api/gemini/* protegidas)
└── components/               # Camada visual Premium Dark (--kz-*) por domínio (Dashboard, CRM, Clientes, Propostas, Projetos, Minhas Tarefas, Agenda Integrada, Redes Sociais, Financeiro + Subviews, Scripts, GlobalAgency, Settings)
```

### Como adicionar os próximos módulos (Produtividade, Materiais etc.)
- Criar novas subcoleções irmãs dentro de `/workspaces/adm_equipeie/`.
- Separar novos fluxos em `src/services/<modulo>Service.ts` + `src/components/<Modulo>View.tsx`, evitando concentrar lógica de cálculo dentro de `src/App.tsx`.
- **Nunca** alterar o significado dos campos existentes de `Lead`, `NicheCampaign` e `ImportedSheet`.

---

## 2. Modelo de Dados & Compatibilidade Retroativa

### Convenções Adotadas
1. **Preservação de IDs Originais:** Documentos existentes (`lead-imp-...`, `niche-padrao`, `sheet-...`) permanecem com seus IDs originais. As Etapas 2–4 utilizam prefixos padronizados (`cli-`, `prop-`, `proj-`, `task-`, `evt-`, `sch-`, `post-`, `fin-`, `fin-rec-`, `ftx-`, `fcat-`, `frec-`, `faud-`, além de `financialSettings/default`), todos compatíveis com `^[a-zA-Z0-9_\-]+$`.
2. **Relacionamentos por ID (Fonte Única de Verdade):**
   - `Lead.nicheId -> NicheCampaign.id`
   - `Client.originLeadId -> Lead.id` e `Client.originNicheId -> NicheCampaign.id` (com importação de notas e reuniões na timeline do Cliente).
   - `ProposalContract.clientId -> Client.id` e `ProposalContract.leadId -> Lead.id`.
   - `Project.clientId -> Client.id` e `Project.proposalId -> ProposalContract.id` (Etapa 3).
   - `Task.projectId -> Project.id` e `Task.clientId -> Client.id` (Etapa 3 — registro único exibido em Projetos, Minhas Tarefas e Agenda Integrada).
   - `AgendaEvent.clientId / leadId / projectId / taskId` (Etapa 3 — eventos diretos unificados em memória sem duplicação).
   - `SocialChannel.clientId -> Client.id` e `SocialPost.clientId / channelId` (Etapa 3).
   - `FinancialEntry.clientId / projectId / proposalId / categoryId / recurrenceId` e `FinancialTransaction.entryId -> FinancialEntry.id` (Etapa 4 — valores monetários sempre em centavos inteiros; estornos geram transação compensatória sem apagar histórico; `financialTransactions`, `financialSettings` e `financialAuditLogs` bloqueiam exclusão pelas regras locais).
3. **Versionamento Retrocompatível (`schemaVersion` e `updatedAt`):**
   - `schemaVersion?: number` e `updatedAt?: string` seguem em todos os tipos e em `firebase-blueprint.json`.
   - Todas as gravações (`sync*` e `batchSync*` para todas as coleções) preenchem automaticamente `schemaVersion` e `updatedAt`.
4. **Datas e Horários:**
   - Datas operacionais e financeiras (`dueDate`, `competenceDate`, `date`, `startDate`) mantêm formato `YYYY-MM-DD` com fuso horário `America/Maceio` no módulo financeiro (`KAIZEN_TIMEZONE`).
   - Timestamps de auditoria (`createdAt`, `updatedAt`) seguem ISO-8601 UTC (`new Date().toISOString()`).
5. **Histórico de Interações e Auditoria:**
   - `Lead.notes` continua embutido no documento para compatibilidade total.
   - `financialTransactions` e `financialAuditLogs` residem em coleções dedicadas imutáveis (`allow delete: if false` / logs `allow update, delete: if false`).

---

## 3. Auditoria das Rotas de API Existentes

| Rota | Status de Uso no Frontend | Proteção Aplicada |
|---|---|---|
| `GET /api/health` | Saúde do servidor | Pública (retorna apenas status + timestamp) |
| `POST /api/gemini/generate-pitch` | Em uso (`LeadModal.tsx`) | Token Firebase Auth + `AUTHORIZED_ADMIN_UID` obrigatório + Rate limit + validação |
| `POST /api/gemini/improve-script` | Em uso (`ScriptsView.tsx`) | Token Firebase Auth + `AUTHORIZED_ADMIN_UID` obrigatório + Rate limit + validação |
| `POST /api/gemini/analyze-leads` | Sem chamada ativa no frontend atual (mantida por compatibilidade) | Token Firebase Auth + `AUTHORIZED_ADMIN_UID` obrigatório + Rate limit + validação |
| `POST /api/gemini/filter-imported-leads` | Sem chamada ativa no frontend atual (`ImporterView.tsx` filtra localmente; mantida por compatibilidade) | Token Firebase Auth + `AUTHORIZED_ADMIN_UID` obrigatório + Rate limit + validação |
