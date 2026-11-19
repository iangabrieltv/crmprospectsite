# KAIZEN — ROADMAP DO SISTEMA DE GESTÃO INTEGRADA

**Projeto:** Kaizen — Sistema Privado de Gestão Integrada  
**Proprietário:** Usuário único administrador (`AUTHORIZED_ADMIN_UID`)  
**Repositório oficial:** `https://github.com/iangabrieltv/crmprospectsite`  
**Stack oficial preservada:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Express (`/api/*`) + Firebase Auth + Firestore (`ai-studio-prospectflowcrmd-6ef58a98-06b1-4109-b7bb-169f00e7a2ea`, workspace `adm_equipeie`)

---

## Visão Geral das Etapas

| Etapa | Escopo Principal | Status |
|---|---|---|
| **Etapa 0** | Fundação de Segurança, Auth Fail-Closed, Backup v3.0, Schema Retrocompatível & Auditoria | **CONCLUÍDA** |
| **Etapa 1** | Fundação Visual **Premium Dark Workspace**, Design System (`--kz-*`), Shell & Padronização do CRM | **CONCLUÍDA** |
| **Etapa 2** | Módulo Comercial Avançado: **Clientes** e **Propostas & Contratos** | **CONCLUÍDA** |
| **Etapa 3** | Módulo Operacional: **Projetos**, **Minhas Tarefas**, **Agenda Integrada** e **Redes Sociais** | **CONCLUÍDA** |
| **Etapa 4** | **Sistema Financeiro Completo** (`/financeiro`): Receitas, Despesas, Baixas/Estornos, Fluxo de Caixa Real vs Projetado, Recorrências e 15 Relatórios PDF/CSV | **CONCLUÍDA** |
| **Etapa 5** | Eficiência & Recursos: **Central de Materiais, Documentos, Scripts e Biblioteca de Modelos** (`/materiais` e `/modelos`) | **CONCLUÍDA (Desenvolvimento)** |
| **Etapa 6** | **Relatórios, Produtividade e Inteligência de Gestão** (`Relatórios e Produtividade`): 9 subáreas analíticas, Inteligência de Gestão, Construtor Personalizado, PDF/CSV e Preferências | **CONCLUÍDA (Desenvolvimento)** |
| **Etapa 7** | **Configurações do Sistema, Assistente IA, Notificações e Automações** conectados ao workspace | **CONCLUÍDA (Desenvolvimento)** |
| **Etapa 8** | **Integração Geral, Auditoria Final e Validação Completa** cross-módulo, segurança, dados e testes E2E | **CONCLUÍDA (Desenvolvimento — Aguardando Autorização para Deploy)** |

---

## Detalhamento por Etapa

### Etapa 0 — Segurança, Persistência e Arquitetura Base *(Concluída)*
- Travamento fail-closed por UID único (`VITE_AUTHORIZED_ADMIN_UID` e `AUTHORIZED_ADMIN_UID`) no login Firebase Auth e nas rotas `/api/gemini/*`.
- Blindagem das regras de segurança do Firestore (`firestore.rules`) e compatibilidade retroativa com `schemaVersion` e `updatedAt` opcionais.
- Engine de backup completo v3.0 com checksum e detecção de duplicidades sem sobrescrita destrutiva.
- Remoção de vazamento de chaves no bundle cliente (`GEMINI_API_KEY` restrita ao backend Express).

### Etapa 1 — Fundação Visual, Design System e Shell *(Concluída)*
- Adoção integral da estética **Premium Dark Workspace** (`#0B0B0D` canvas, `#101014` sidebar, `#121216` superfícies, `#19191F` controles elevados, `#222229` hover e `#C6A15B` acento dourado executivo).
- Biblioteca padronizada de 15 primitivos UI em `src/components/ui/` (`Button`, `Input`, `Select`, `Textarea`, `Card`, `Badge`, `Table`, `Dropdown`, `Modal`, `ConfirmDialog`, `Tooltip`, `Breadcrumbs`, `Tabs`, `Pagination`, `Alert`, `Toast`, `EmptyState`, `Skeleton`, `Spinner`).
- Shell estruturada com **6 grupos / 16 módulos** na `Sidebar`, `Header` contextual com notificações reais da Agenda, `DashboardView` com KPIs reais e `ModulePlaceholder` honesto para os módulos futuros.
- Padronização visual completa do CRM (`KanbanView`, `LeadCard`, `LeadModal`, `LeadsListView`, `AgendaView`, `ScriptsView`, `ImporterView`, `GlobalAgencyView`, `SettingsView`, `LoginView`) preservando 100% da lógica de negócio e Firestore sync.

### Etapa 2 — Comercial: Clientes & Propostas/Contratos *(Concluída)*
- **Clientes (`/clientes`):**
  - Cadastro completo de clientes ativos, onboarding, pausados e encerrados com conversão direta a partir de leads do CRM (`Client.originLeadId -> Lead.id`) sem duplicação nem perda de histórico (`notes` e reuniões importadas na linha do tempo).
  - Dados contratuais, responsável, infraestrutura (domínio/hospedagem), MRR acordado, início de vigência e relacionamentos completos.
  - Desbloqueio do indicador real **`Clientes ativos`** no `DashboardView` e soma de receita mensal sem dupla contagem entre leads fechados e clientes convertidos.
- **Propostas e Contratos (`/propostas`):**
  - Builder estruturado de propostas comerciais e contratos (`KZ-P-YYYY-NNN` / `KZ-C-YYYY-NNN`) com itens de escopo (Setup, Mensal, Pontual), prazos, condições de pagamento e cláusulas padrão.
  - Fluxo completo de status (`rascunho`, `enviada`, `em_negociacao`, `aprovada`, `assinada`, `recusada`, `expirada`), histórico, envio resumido por WhatsApp, sincronização automática com Cliente e geração de **PDF A4 client-side (`jspdf`)** sem popups (`window.open`).

### Etapa 3 — Operação: Projetos, Minhas Tarefas, Agenda Integrada & Redes Sociais *(Concluída)*
- **Projetos (`/projetos`):** administração de projetos vinculados a clientes e propostas com modelos independentes (**Kaizen Start**, **Kaizen Performance 90 dias** e **Personalizado**) e progresso por tarefas reais sem auto-conclusão.
- **Minhas Tarefas (`/tarefas`):** central de fonte única de dados com 6 filas, Lista, Quadro Kanban e checklists.
- **Agenda Integrada (`/agenda`):** calendário Mensal, Semanal, Diário e lista unificada (AgendaEvent + Project + Task + Lead) sem duplicação.
- **Redes Sociais (`/redes-sociais`):** canais e calendário editorial/Kanban da Kaizen e apenas de clientes elegíveis, sem auto-publicação.

### Etapa 4 — Sistema Financeiro Completo *(Concluída)*
- **Financeiro (`/financeiro`):**
  - Precisão monetária em **centavos inteiros** (`amountCents`, `settledCents`, `openingBalanceCents`), formatação `BRL`, formato `DD/MM/YYYY` e fuso horário `America/Maceio`.
  - **10 subáreas** (`Visão Geral`, `Receitas`, `Despesas`, `Contas a Receber`, `Contas a Pagar`, `Fluxo de Caixa`, `Recorrências`, `Categorias`, `Relatórios`, `Configurações`) + **10 opções de período** global.
  - **Receitas & Despesas** com criação, edição, cancelamento preservando histórico, baixas parciais/totais sem permitir exceder o saldo sem acréscimo explícito, e estorno rastreável com log imutável (`FinancialTransaction` + `FinancialAuditLog`).
  - **Fluxo de Caixa** diário, semanal, mensal e anual com separação estrita entre **Realizado** e **Projetado** e isolamento do saldo inicial em relação à receita operacional.
  - **Recorrências** idempotentes sem dupla geração, com edição aplicada apenas a ocorrências futuras e respeito a pausas/encerramentos (sem baixas automáticas).
  - **15 Relatórios Gerenciais** completos com visualização executiva, exportação **CSV (UTF-8 BOM sanitizado)**, impressão **PDF A4 (`jsPDF`)** e modo impressão `@media print`.
  - **Integração transversal:** resumo financeiro dentro de **Clientes** (`ClientDetailModal`), rentabilidade dentro de **Projetos** (`ProjectDetailModal`), geração explícita de previsão financeira em **Propostas & Contratos** (`ProposalPreviewModal`), receita realizada e a receber no **Dashboard**, alertas no **Header** e suporte integral nas **6 coleções financeiras** em `localStorage`, Backup JSON v3.0, `firebase-blueprint.json` e `firestore.rules` locais (aguardando publicação remota pelo administrador).

### Etapa 5 — Central de Materiais, Documentos, Scripts e Biblioteca de Modelos *(Concluída em Desenvolvimento)*
- **Central de Recursos (`/materiais` e `/modelos`) com 6 áreas integradas:**
  - **Visão Geral:** KPIs reais (arquivos cadastrados, favoritos, scripts ativos, modelos disponíveis, distribuição por categoria, arquivos vinculados a clientes e projetos) com atalhos diretos (sem lista genérica de movimentações).
  - **Arquivos e Documentos:** upload com validação estrita de segurança (15 formatos permitidos: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.png`, `.jpg`, `.jpeg`, `.svg`, `.mp4`, `.txt`, `.csv`, `.zip`, limite de 25 MB, bloqueio de executáveis/dupla extensão), armazenamento híbrido honesto (`Firebase Storage` quando publicado + cofre local `IndexedDB` fallback dev sem poluir Firestore), pré-visualização inline por tipo (`image`, `pdf`, `video`, `text`, `spreadsheet`), pastas hierárquicas, tags, favoritos, renomeio e arquivamento seguro para itens com vínculo histórico.
  - **Clientes e Projetos:** visualização unificada agrupada por seções (Identidade Visual, Contratos, Propostas, Briefings, Imagens, Vídeos, Entregáveis, Outros / Documentos, Referência, Artes, Arquivos Finais, Entregáveis), com herança automática de arquivos de projetos para o cliente correspondente sem duplicação.
  - **Scripts Comerciais:** acervo editável com 11 scripts iniciais e 14 categorias, interpolação real de variáveis (`{{nome}}`, `{{empresa}}`, `{{servico}}`, `{{cidade}}`, `{{link}}`, `{{nome_agencia}}`) sem invenção de dados faltantes (variáveis ausentes sinalizadas explicitamente), contador de uso, cópia e disparo via link WhatsApp.
  - **Biblioteca de Modelos:** 7 modelos iniciais entre Propostas, Contratos, Projetos (`Kaizen Start`, `Kaizen Performance 90 dias`), Checklists, Planos Sociais e SOPs internos, com instanciação **100% independente** (editar o modelo depois nunca altera documentos/projetos/tarefas já criados).
  - **Categorias e Organização:** gestão das categorias nos 3 domínios (Arquivos, Scripts, Modelos) com contagem de referências e bloqueio contra exclusão quando vinculadas.
  - **Integrações transversais:** aba **Materiais & Doc.** em **Clientes**, aba **Documentos & Materiais** em **Projetos**, seletor de anexos em **Tarefas** (`TaskFormModal` / `TasksView`), seletor de artes/materiais em **Redes Sociais** (`SocialPostModal` / `SocialView`), seletor de modelos na criação de **Propostas & Contratos**, scripts comerciais no modal de **Leads** e atalho no módulo **Scripts**, além de suporte completo no Backup v3.0, `firebase-blueprint.json`, `firestore.rules` e `storage.rules` locais (aguardando publicação remota pelo administrador).
- **Produtividade:** incorporada na Etapa 6 dentro do módulo consolidado **Relatórios e Produtividade**.

### Etapa 6 — Relatórios, Produtividade e Inteligência de Gestão *(Concluída em Desenvolvimento)*
- **Relatórios e Produtividade (`productivity` -> `AnalyticsHubView`):**
  - Central executiva de **9 áreas** (`Visão Geral`, `Comercial`, `Financeiro`, `Operacional`, `Clientes`, `Projetos`, `Redes Sociais`, `Produtividade`, `Personalizados`) consumindo exclusivamente os dados reais dos módulos existentes (sem duplicar CRM, Financeiro ou Tarefas).
  - **10 janelas de período** no fuso `America/Maceio` (`hoje`, `ontem`, `ultimos_7_dias`, `ultimos_30_dias`, `este_mes`, `mes_anterior`, `ultimos_90_dias`, `este_semestre`, `este_ano`, `personalizado`) com comparativos automáticos ao período equivalente anterior.
  - **Paridade Financeira 100%:** delega diretamente para `computeFinanceDashboardSnapshot` e `computeCashFlow` de `src/services/finance/*`, separando **Realizado** de **Previsto/Projetado** e preservando saldo inicial isolado.
  - **Inteligência de Gestão:** leituras automáticas verificáveis com citação explícita de evidência e amostra/denominador e links diretos de ação.
  - **Construtor de Relatórios Personalizados:** seleção de 9 bases com guardrails contra combinações inválidas de filtros, persistência de modelos salvos/favoritos em `localStorage`, Firestore (`customReports`) e Backup JSON v3.0.
  - **Exportação:** CSV UTF-8 BOM anti-injeção de fórmula e PDF A4 client-side (`jsPDF`, sem `window.open`), além de modal de preferências (`analyticsSettings`) com KPIs favoritos e modo compacto.
  - **Transparência obrigatória:** sinaliza explicitamente ausência de canal de origem em Leads, ausência de apontamento de horas trabalhadas em Produtividade e ausência de conexão com APIs externas de redes sociais em Redes Sociais.

### Etapa 7 — Configurações do Sistema, Assistente IA, Notificações e Automações *(Concluída em Desenvolvimento)*
- **Configurações do Sistema (`settings` -> `SettingsView`):** 6 subáreas (`Visão Geral`, `Perfil e Marca`, `Preferências`, `Integrações`, `Logs do Sistema` e `Backup e Dados`), propagação de branding do emissor para Propostas & PDFs, trava do tema **Premium Dark** e padrões regionais (`BRL`, `DD/MM/YYYY`, `America/Maceio`), diagnóstico real de integrações (`checkSystemIntegrationsStatus`), logs operacionais sanitizados (`logSanitizerService`) e Backup JSON v3.0 + Reset seguro (`ZERAR`).
- **Assistente IA (`ai_assistant` -> `AiAssistantView`):** conectado exclusivamente às rotas protegidas `/api/gemini/status` e `/api/gemini/assistant-chat` no backend Express, com histórico de conversas em `aiConversations`, sugestões inteligentes determinísticas (`computeSmartAiSuggestions`) mesmo sem `GEMINI_API_KEY`, e ações assistidas (`create_task`, `whatsapp_draft`, `meeting_brief`, `prioritize_note`) executadas **somente** após confirmação explícita em prévia editável.
- **Notificações (`notifications` -> `NotificationsView` + `Header`):** motor deduplicado (`evaluateWorkspaceNotifications`) conectado a leads, propostas, agenda, tarefas, projetos e vencimentos financeiros com filtros, leitura persistida, dispensa e links diretos de módulo.
- **Automações (`automations` -> `AutomationsView`):** 11 regras comerciais, operacionais e financeiras (`manual_ou_ao_abrir`) com histórico auditável em `automationLogs`, sem cron oculto, sem auto-baixa financeira, sem exclusões e sem envios automáticos externos.

### Etapa 8 — Integração Geral, Auditoria Final e Validação Completa *(Concluída em Desenvolvimento)*
- **Auditoria Completa dos 16 Módulos:** verificação direta de código, serviços, persistência e segurança em toda a aplicação (`docs/RELATORIO_ETAPA_8.md`).
- **Ajustes Cirúrgicos de Consistência:**
  - `DashboardView`: separação explícita de **`Receita mensal (realizada)`** em relação ao `MRR contratado` (sem substituir zero realizado por MRR) e alinhamento do indicador **`Compromissos (Agenda Integrada)`** ao motor canônico `buildIntegratedAgendaItems` (próximos 7 dias + indicação clara de escopo global no bloco operacional).
  - `Header`, `SettingsView` e `GlobalAgencyView`: esclarecimento honesto dos botões e modais de reset para **`Zerar Base do CRM`**, informando que Clientes, Propostas, Projetos, Tarefas, Financeiro, Materiais e Configurações são preservados.
  - `AnalyticsHubView` + `App.tsx`: propagação de `agencyName` de `systemSettings.adminProfile` para os relatórios PDF executivos.
- **Validação E2E Cross-Módulo (`tests/kaizenEtapa8.test.ts`):** validação dos 6 fluxos ponta a ponta (Lead -> Cliente -> Proposta/PDF -> Projeto/Tarefas/Agenda -> Financeiro/Dashboard/Analytics -> Materiais/Segurança -> Notificações/IA Guardrails), com **98/98 testes aprovados**, `tsc --noEmit` limpo, `vite build` aprovado e servidor dev validado na porta `3000`.
- **Pendências externas registradas para pré-produção:** publicação remota de `firestore.rules` e `storage.rules`, configuração de `GEMINI_API_KEY` em produção/servidor, execução local da suíte `npm run test:rules` em máquina com Java JRE e criação de `package-lock.json` para auditoria `npm audit`.

---

## Regras Arquiteturais Obrigatórias para as Próximas Etapas

1. **Workspace Único no Firestore:** Todas as novas coleções devem residir sob `/workspaces/adm_equipeie/<colecao>/<docId>`, seguindo validação estrita em `firestore.rules`.
2. **Retrocompatibilidade:** Nunca alterar ou migrar destrutivamente `leads`, `niches` ou `importedSheets`. Sempre preencher `schemaVersion` e `updatedAt` via helpers centralizados.
3. **Design System Único:** Toda nova tela deve usar exclusivamente os tokens `--kz-*` (`#0B0B0D` / `#121216` / `#19191F` / `#C6A15B`) e os primitivos de `src/components/ui/`.
4. **Honestidade de Dados:** Nunca gerar métricas sintéticas, notificações simuladas ou dados fictícios no banco de dados.
5. **Segurança Server-Side:** Qualquer chamada Gemini ou automação com segredos deve passar por `/api/*` autenticada com Firebase ID Token + `AUTHORIZED_ADMIN_UID`.
