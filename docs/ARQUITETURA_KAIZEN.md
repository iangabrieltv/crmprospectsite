# Arquitetura e Preparação para Expansão — Kaizen (Etapa 0)

Este documento define as convenções técnicas adotadas a partir da Etapa 0 para evoluir o ProspectFlow CRM no sistema interno completo da agência Kaizen **sem quebrar nem migrar destrutivamente os dados já existentes**.

---

## 1. Estrutura Modular Atual e Evolução Incremental

```text
src/
├── config/
│   └── env.ts                # Resolução de variáveis por ambiente (prod/staging/emulator)
├── services/
│   ├── authService.ts        # Sessão Firebase Auth (usuário único) + obtenção de ID token
│   └── backupService.ts      # Backup v3.0 (leads + niches + importedSheets), checksum e pré-análise de restauração
├── utils/
│   ├── firebase.ts           # Conexão Firestore nomeado, listeners onSnapshot e gravações com schemaVersion/updatedAt
│   ├── storage.ts            # Cache localStorage seguro (sem filtros ou sobrescritas destrutivas)
│   ├── phone.ts              # Normalização E.164, saudações e links wa.me
│   └── initialData.ts        # Campanha padrão limpa (sem dados fictícios de leads)
├── api/
│   ├── securityMiddleware.ts # Verificação Bearer JWT Firebase, trava por UID único, rate limit e headers
│   └── routes.ts             # Rotas Express (/api/health e /api/gemini/* protegidas)
└── components/               # Camada visual por domínio (Kanban, Agenda, Scripts, Importer, GlobalAgency, Login)
```

### Como adicionar os próximos módulos (Clientes, Projetos, Tarefas, Financeiro etc.)
- Criar novas subcoleções irmãs dentro de `/workspaces/adm_equipeie/` (ex.: `clients`, `projects`, `tasks`, `transactions`, `proposals`, `contracts`, `assets`).
- Separar novos fluxos em `src/services/<modulo>Service.ts` + `src/hooks/use<Modulo>.ts` + `src/components/<Modulo>View.tsx`, evitando concentrar estado e regras de negócio dentro de `src/App.tsx`.
- **Nunca** alterar o significado dos campos existentes de `Lead`, `NicheCampaign` e `ImportedSheet`.

---

## 2. Modelo de Dados & Compatibilidade Retroativa

### Convenções Adotadas
1. **Preservação de IDs Originais:** Documentos existentes (`lead-imp-...`, `niche-padrao`, `sheet-...`) permanecem com seus IDs originais. Novos módulos devem usar prefixos claros e caracteres válidos `^[a-zA-Z0-9_\-]+$` (ex.: `cli-<timestamp>-<rand>`, `prj-...`, `tsk-...`).
2. **Relacionamentos por ID:**
   - `Lead.nicheId -> NicheCampaign.id`
   - Futuro `Client.originLeadId -> Lead.id` (opcional, permitindo cadastrar clientes diretos ou converter leads fechados sem alterar documentos antigos de leads).
   - Futuro `Project.clientId -> Client.id` e `Task.projectId -> Project.id`.
3. **Versionamento Retrocompatível (`schemaVersion` e `updatedAt`):**
   - `schemaVersion?: number` e `updatedAt?: string` foram adicionados de forma **opcional** em `src/types/crm.ts` e `firebase-blueprint.json`.
   - Todas as novas gravações (`syncLeadToFirestore`, `syncNicheToFirestore`, `syncImportedSheetToFirestore`, `batchSync*`) preenchem automaticamente `schemaVersion: data.schemaVersion ?? 1` e `updatedAt: new Date().toISOString()`.
   - Documentos antigos que não possuem esses campos continuam sendo lidos normalmente em tempo de leitura, sem exigir migração em massa no Firestore.
4. **Datas e Horários:**
   - Datas de eventos/agenda mantêm formato `YYYY-MM-DD` e horários `HH:MM` (compatível com `meetingDate`, `callbackDate` e inputs HTML nativos).
   - Timestamps de auditoria (`createdAt`, `updatedAt`, `importedAt`, `lastContactDate`) seguem ISO-8601 UTC (`new Date().toISOString()`).
5. **Histórico de Interações:**
   - `Lead.notes` continua embutido no documento para preservar 100% de compatibilidade com leads existentes. Quando módulos de Projetos/Clientes ou logs de automação forem criados, históricos extensos devem usar subcoleções dedicadas (ex.: `clients/{id}/timeline/{eventId}`) para não se aproximar do limite de 1 MB por documento no Firestore.

---

## 3. Auditoria das Rotas de API Existentes

| Rota | Status de Uso no Frontend | Proteção Aplicada |
|---|---|---|
| `GET /api/health` | Saúde do servidor | Pública (retorna apenas status + timestamp) |
| `POST /api/gemini/generate-pitch` | Em uso (`LeadModal.tsx`) | Token Firebase Auth + UID único opcional + Rate limit + validação |
| `POST /api/gemini/improve-script` | Em uso (`ScriptsView.tsx`) | Token Firebase Auth + UID único opcional + Rate limit + validação |
| `POST /api/gemini/analyze-leads` | Sem chamada ativa no frontend atual (mantida por compatibilidade) | Token Firebase Auth + UID único opcional + Rate limit + validação |
| `POST /api/gemini/filter-imported-leads` | Sem chamada ativa no frontend atual (`ImporterView.tsx` filtra localmente; mantida por compatibilidade) | Token Firebase Auth + UID único opcional + Rate limit + validação |
