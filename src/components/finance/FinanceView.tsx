import React, { useMemo, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { Alert, Button, Input, Select, Tabs } from '../ui';
import {
  FINANCIAL_PERIOD_OPTIONS,
  FINANCIAL_SUBVIEWS,
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialKind,
  FinancialPaymentMethod,
  FinancialPeriodPreset,
  FinancialRecurrence,
  FinancialRecurrenceFrequency,
  FinancialRecurrenceStatus,
  FinancialSettings,
  FinancialSubViewId,
  FinancialTransaction,
} from '../../types/finance';
import { Client, Project, ProposalContract } from '../../types/kaizen';
import {
  KAIZEN_TIMEZONE,
  computeFinanceDashboardSnapshot,
  getTodayInTimezone,
  resolvePeriodRange,
} from '../../services/finance';
import { FinanceDashboardTab } from './FinanceDashboardTab';
import { FinanceEntriesTab } from './FinanceEntriesTab';
import { FinanceCashFlowTab } from './FinanceCashFlowTab';
import { FinanceRecurrencesTab } from './FinanceRecurrencesTab';
import { FinanceCategoriesTab } from './FinanceCategoriesTab';
import { FinanceReportsTab } from './FinanceReportsTab';
import { FinanceSettingsTab } from './FinanceSettingsTab';
import { FinanceEntryModal } from './FinanceEntryModal';
import { FinanceSettleModal } from './FinanceSettleModal';
import { FinanceRecurrenceModal } from './FinanceRecurrenceModal';

interface FinanceViewProps {
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  recurrences: FinancialRecurrence[];
  settings: FinancialSettings;
  auditLogs: FinancialAuditLog[];
  clients: Client[];
  projects: Project[];
  proposals: ProposalContract[];
  cloudBlocked?: boolean;
  onSaveEntry: (payload: {
    id?: string;
    kind: FinancialKind;
    description: string;
    clientId?: string;
    supplierName?: string;
    serviceName?: string;
    projectId?: string;
    proposalId?: string;
    contractCode?: string;
    categoryId: string;
    amountCents: number;
    competenceDate: string;
    dueDate: string;
    paymentMethod: FinancialPaymentMethod;
    initialStatus: 'prevista' | 'pendente';
    attachmentUrl?: string;
    notes?: string;
  }) => Promise<void>;
  onCancelEntry: (entry: FinancialEntry, reason: string) => Promise<void>;
  onSettleEntry: (params: {
    entry: FinancialEntry;
    amountCents: number;
    date: string;
    paymentMethod: FinancialPaymentMethod;
    adjustmentCents?: number;
    notes?: string;
  }) => Promise<void>;
  onReverseTransaction: (params: {
    entry: FinancialEntry;
    transaction: FinancialTransaction;
    reason: string;
    date: string;
  }) => Promise<void>;
  onSaveRecurrence: (payload: {
    editingId?: string;
    name: string;
    kind: FinancialKind;
    amountCents: number;
    categoryId: string;
    clientId?: string;
    supplierName?: string;
    serviceName?: string;
    projectId?: string;
    paymentMethod: FinancialPaymentMethod;
    frequency: FinancialRecurrenceFrequency;
    customIntervalDays?: number;
    startDate: string;
    endDate?: string;
    notes?: string;
  }) => Promise<void>;
  onChangeRecurrenceStatus: (
    rec: FinancialRecurrence,
    status: FinancialRecurrenceStatus
  ) => Promise<void>;
  onProcessDueRecurrences: () => Promise<number>;
  onSaveCategory: (payload: {
    editingId?: string;
    name: string;
    kind: FinancialKind;
    description?: string;
    active: boolean;
  }) => Promise<void>;
  onSaveSettings: (
    nextSettings: FinancialSettings,
    openingBalanceChanged: boolean
  ) => Promise<void>;
  onOpenClient?: (clientId: string) => void;
  onOpenProposal?: (proposalId: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  entries,
  transactions,
  categories,
  recurrences,
  settings,
  auditLogs,
  clients,
  projects,
  proposals,
  cloudBlocked = false,
  onSaveEntry,
  onCancelEntry,
  onSettleEntry,
  onReverseTransaction,
  onSaveRecurrence,
  onChangeRecurrenceStatus,
  onProcessDueRecurrences,
  onSaveCategory,
  onSaveSettings,
  onOpenClient,
  onOpenProposal,
}) => {
  const todayStr = getTodayInTimezone(settings.timezone || KAIZEN_TIMEZONE);
  const [activeSubView, setActiveSubView] =
    useState<FinancialSubViewId>('visao_geral');
  const [periodPreset, setPeriodPreset] =
    useState<FinancialPeriodPreset>('este_mes');
  const [customStart, setCustomStart] = useState(todayStr.slice(0, 7) + '-01');
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Modais
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryModalKind, setEntryModalKind] = useState<FinancialKind>('receita');
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);

  const [settlingEntryId, setSettlingEntryId] = useState<string | null>(null);

  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] =
    useState<FinancialRecurrence | null>(null);

  const resolvedRange = useMemo(
    () => resolvePeriodRange(periodPreset, customStart, customEnd, todayStr),
    [periodPreset, customStart, customEnd, todayStr]
  );

  const dashboardSnapshot = useMemo(
    () =>
      computeFinanceDashboardSnapshot({
        entries,
        transactions,
        categories,
        settings,
        clients,
        preset: periodPreset,
        customStart,
        customEnd,
        todayStr,
      }),
    [
      entries,
      transactions,
      categories,
      settings,
      clients,
      periodPreset,
      customStart,
      customEnd,
      todayStr,
    ]
  );

  const settlingEntry = useMemo(
    () =>
      settlingEntryId
        ? entries.find((e) => e.id === settlingEntryId) || null
        : null,
    [entries, settlingEntryId]
  );

  const notify = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => setBannerMessage(null), 6000);
  };

  const openNewEntryModal = (kind: FinancialKind) => {
    setEditingEntry(null);
    setEntryModalKind(kind);
    setEntryModalOpen(true);
  };

  const openEditEntryModal = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setEntryModalKind(entry.kind);
    setEntryModalOpen(true);
  };

  const handleProcessRecurrences = async () => {
    const count = await onProcessDueRecurrences();
    if (count > 0) {
      notify(
        `${count} ocorrência(s) recorrente(s) devida(s) gerada(s) em aberto (sem baixas automáticas).`
      );
    } else {
      notify('Nenhuma nova ocorrência vencida ou devida pendente de geração até hoje.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Cabeçalho + Filtro Global de Período (10 opções) */}
      <div className="border-b border-[var(--kz-border-subtle)] pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 kz-no-print">
        <div>
          <h2 className="kz-page-title">Sistema Financeiro Kaizen</h2>
          <p className="kz-subtitle mt-1">
            Gestão financeira completa em BRL (R$) com separação entre realizado e previsto, fluxo
            de caixa, recorrências e relatórios gerenciais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-lg px-2.5 h-9">
            <Calendar className="w-3.5 h-3.5 text-[var(--kz-accent)] shrink-0" />
            <Select
              value={periodPreset}
              onChange={(e) =>
                setPeriodPreset(e.target.value as FinancialPeriodPreset)
              }
              className="!border-0 !bg-transparent !h-7 !px-1 text-xs font-medium"
            >
              {FINANCIAL_PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {periodPreset === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="!w-36"
              />
              <span className="text-xs text-[var(--kz-text-muted)]">até</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="!w-36"
              />
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => openNewEntryModal('receita')}
          >
            Lançar Receita
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => openNewEntryModal('despesa')}
          >
            Lançar Despesa
          </Button>
        </div>
      </div>

      {/* Aviso honesto caso as regras remotas do Firestore ainda não tenham sido publicadas */}
      {cloudBlocked && (
        <Alert variant="warning" className="kz-no-print">
          <strong>Modo local ativo para as coleções financeiras:</strong> os lançamentos e
          movimentações estão sendo persistidos com segurança neste navegador, mas a sincronização
          com o Firestore remoto aguarda publicação manual do arquivo local{' '}
          <code className="font-mono">firestore.rules</code> no Console Firebase.
        </Alert>
      )}

      {bannerMessage && (
        <Alert
          variant="success"
          onDismiss={() => setBannerMessage(null)}
          className="kz-no-print"
        >
          {bannerMessage}
        </Alert>
      )}

      {/* Navegação entre as 10 subáreas */}
      <div className="kz-no-print">
        <Tabs<FinancialSubViewId>
          variant="underline"
          activeId={activeSubView}
          onChange={setActiveSubView}
          items={FINANCIAL_SUBVIEWS.map((sv) => ({
            id: sv.id,
            label: sv.label,
            badge:
              sv.id === 'contas_a_receber' && dashboardSnapshot.delinquencyCount > 0
                ? dashboardSnapshot.delinquencyCount
                : undefined,
          }))}
        />
      </div>

      {/* Subárea ativa */}
      {activeSubView === 'visao_geral' && (
        <FinanceDashboardTab
          snapshot={dashboardSnapshot}
          onNavigateSubView={setActiveSubView}
          onOpenNewEntry={openNewEntryModal}
        />
      )}

      {(activeSubView === 'receitas' ||
        activeSubView === 'despesas' ||
        activeSubView === 'contas_a_receber' ||
        activeSubView === 'contas_a_pagar') && (
        <FinanceEntriesTab
          mode={activeSubView}
          entries={entries}
          categories={categories}
          clients={clients}
          projects={projects}
          proposals={proposals}
          alertDaysAhead={settings.alertDaysAhead ?? 5}
          startDate={resolvedRange.startDate}
          endDate={resolvedRange.endDate}
          onNewEntry={openNewEntryModal}
          onEditEntry={openEditEntryModal}
          onSettleEntry={(entry) => setSettlingEntryId(entry.id)}
          onCancelEntry={async (entry, reason) => {
            await onCancelEntry(entry, reason);
            notify(`Lançamento "${entry.description}" cancelado com histórico preservado.`);
          }}
          onOpenClient={onOpenClient}
          onOpenProposal={onOpenProposal}
          onNotify={notify}
        />
      )}

      {activeSubView === 'fluxo_de_caixa' && (
        <FinanceCashFlowTab
          entries={entries}
          transactions={transactions}
          settings={settings}
          startDate={resolvedRange.startDate}
          endDate={resolvedRange.endDate}
          periodLabel={resolvedRange.label}
          onGoToSettings={() => setActiveSubView('configuracoes')}
        />
      )}

      {activeSubView === 'recorrencias' && (
        <FinanceRecurrencesTab
          recurrences={recurrences}
          entries={entries}
          categories={categories}
          clients={clients}
          onNewRecurrence={() => {
            setEditingRecurrence(null);
            setRecurrenceModalOpen(true);
          }}
          onEditRecurrence={(rec) => {
            setEditingRecurrence(rec);
            setRecurrenceModalOpen(true);
          }}
          onChangeStatus={async (rec, status) => {
            await onChangeRecurrenceStatus(rec, status);
            notify(`Recorrência "${rec.name}" marcada como ${status}.`);
          }}
          onProcessDueOccurrences={handleProcessRecurrences}
        />
      )}

      {activeSubView === 'categorias' && (
        <FinanceCategoriesTab
          categories={categories}
          entries={entries}
          recurrences={recurrences}
          onSaveCategory={async (payload) => {
            await onSaveCategory(payload);
            notify(`Categoria "${payload.name}" salva com sucesso.`);
          }}
        />
      )}

      {activeSubView === 'relatorios' && (
        <FinanceReportsTab
          entries={entries}
          transactions={transactions}
          categories={categories}
          recurrences={recurrences}
          settings={settings}
          clients={clients}
          projects={projects}
          startDate={resolvedRange.startDate}
          endDate={resolvedRange.endDate}
          periodLabel={resolvedRange.label}
          onNotify={notify}
        />
      )}

      {activeSubView === 'configuracoes' && (
        <FinanceSettingsTab
          settings={settings}
          onSaveSettings={async (next, changedOpening) => {
            await onSaveSettings(next, changedOpening);
            notify(
              changedOpening
                ? 'Configurações financeiras e novo snapshot de saldo inicial gravados.'
                : 'Configurações financeiras atualizadas.'
            );
          }}
        />
      )}

      {/* Modais financeiros */}
      <FinanceEntryModal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        defaultKind={entryModalKind}
        editingEntry={editingEntry}
        categories={categories}
        clients={clients}
        projects={projects}
        proposals={proposals}
        onSave={async (payload) => {
          await onSaveEntry(payload);
          notify(
            payload.id
              ? `Lançamento "${payload.description}" atualizado.`
              : `Novo lançamento "${payload.description}" criado.`
          );
        }}
      />

      <FinanceSettleModal
        isOpen={Boolean(settlingEntry)}
        onClose={() => setSettlingEntryId(null)}
        entry={settlingEntry}
        transactions={transactions}
        auditLogs={auditLogs}
        onConfirmSettlement={async (params) => {
          await onSettleEntry(params);
          notify(`Movimentação registrada em "${params.entry.description}".`);
        }}
        onReverseTransaction={async (params) => {
          await onReverseTransaction(params);
          notify(`Estorno registrado preservando a trilha contábil.`);
        }}
      />

      <FinanceRecurrenceModal
        isOpen={recurrenceModalOpen}
        onClose={() => setRecurrenceModalOpen(false)}
        editingRecurrence={editingRecurrence}
        categories={categories}
        clients={clients}
        projects={projects}
        onSave={async (payload) => {
          await onSaveRecurrence(payload);
          notify(
            payload.editingId
              ? `Recorrência "${payload.name}" atualizada para ocorrências futuras.`
              : `Recorrência "${payload.name}" criada.`
          );
        }}
      />
    </div>
  );
};
