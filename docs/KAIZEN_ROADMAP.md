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
| **Etapa 5** | Eficiência & Recursos: **Produtividade**, **Materiais e Documentos** e **Biblioteca de Modelos** | **PLANEJADA (Aguardando autorização)** |
| **Etapa 6** | **Assistente IA & Automações** transversais com Gemini server-side | **PLANEJADA** |

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

### Etapa 5 — Produtividade & Central de Recursos *(Planejada)*
- **Produtividade (`/produtividade`):** metas diárias de prospecção, foco operacional e cadência semanal do administrador.
- **Materiais e Documentos (`/materiais`):** repositório organizado de assets, briefings, apresentações institucionais e links úteis da agência.
- **Biblioteca de Modelos (`/modelos`):** templates reutilizáveis de propostas, contratos, checklists de onboarding e estruturas de páginas para reutilização rápida.

### Etapa 6 — Assistente IA & Automações
- **Assistente IA (`/ia`):** copiloto operacional conectado exclusivamente às rotas protegidas `/api/gemini/*` para diagnóstico comercial, geração de propostas, revisão de textos e resumos executivos baseados nos dados reais do workspace.

---

## Regras Arquiteturais Obrigatórias para as Próximas Etapas

1. **Workspace Único no Firestore:** Todas as novas coleções devem residir sob `/workspaces/adm_equipeie/<colecao>/<docId>`, seguindo validação estrita em `firestore.rules`.
2. **Retrocompatibilidade:** Nunca alterar ou migrar destrutivamente `leads`, `niches` ou `importedSheets`. Sempre preencher `schemaVersion` e `updatedAt` via helpers centralizados.
3. **Design System Único:** Toda nova tela deve usar exclusivamente os tokens `--kz-*` (`#0B0B0D` / `#121216` / `#19191F` / `#C6A15B`) e os primitivos de `src/components/ui/`.
4. **Honestidade de Dados:** Nunca gerar métricas sintéticas, notificações simuladas ou dados fictícios no banco de dados.
5. **Segurança Server-Side:** Qualquer chamada Gemini ou automação com segredos deve passar por `/api/*` autenticada com Firebase ID Token + `AUTHORIZED_ADMIN_UID`.
