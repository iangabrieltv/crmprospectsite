import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableHeader,
} from '../ui';
import {
  FINANCIAL_ENTRY_STATUS_META,
  FINANCIAL_PAYMENT_METHOD_OPTIONS,
  FinancialCategory,
  FinancialEntry,
  FinancialKind,
  getPaymentMethodLabel,
} from '../../types/finance';
import { Client, Project, ProposalContract } from '../../types/kaizen';
import {
  KAIZEN_TIMEZONE,
  buildEntriesCsv,
  formatBrlFromCents,
  formatDateBr,
  getCategoryName,
  getDaysOverdue,
  getDaysUntilDue,
  getEffectiveEntryStatus,
  getEntryAllowedTotalCents,
  getEntryPendingCents,
  getTodayInTimezone,
  triggerCsvDownload,
} from '../../services/finance';

export type EntriesTabMode =
  | 'receitas'
  | 'despesas'
  | 'contas_a_receber'
  | 'contas_a_pagar';

interface FinanceEntriesTabProps {
  mode: EntriesTabMode;
  entries: FinancialEntry[];
  categories: FinancialCategory[];
  clients: Client[];
  projects: Project[];
  proposals: ProposalContract[];
  alertDaysAhead: number;
  startDate: string;
  endDate: string;
  onNewEntry: (kind: FinancialKind) => void;
  onEditEntry: (entry: FinancialEntry) => void;
  onSettleEntry: (entry: FinancialEntry) => void;
  onCancelEntry: (entry: FinancialEntry, reason: string) => Promise<void>;
  onOpenClient?: (clientId: string) => void;
  onOpenProposal?: (proposalId: string) => void;
  onNotify: (msg: string) => void;
}

export const FinanceEntriesTab: React.FC<FinanceEntriesTabProps> = ({
  mode,
  entries,
  categories,
  clients,
  projects,
  proposals,
  alertDaysAhead,
  startDate,
  endDate,
  onNewEntry,
  onEditEntry,
  onSettleEntry,
  onCancelEntry,
  onOpenClient,
  onOpenProposal,
  onNotify,
}) => {
  const isReceivableSide = mode === 'receitas' || mode === 'contas_a_receber';
  const isLedgerMode = mode === 'contas_a_receber' || mode === 'contas_a_pagar';
  const targetKind: FinancialKind = isReceivableSide ? 'receita' : 'despesa';
  const todayStr = getTodayInTimezone(KAIZEN_TIMEZONE);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    isLedgerMode ? 'em_aberto' : 'todas'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [methodFilter, setMethodFilter] = useState<string>('todas');
  const [clientFilter, setClientFilter] = useState<string>('todos');
  const [usePeriodFilter, setUsePeriodFilter] = useState<boolean>(!isLedgerMode);

  const [cancellingEntry, setCancellingEntry] = useState<FinancialEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const proposalMap = useMemo(
    () => new Map(proposals.map((p) => [p.id, p])),
    [proposals]
  );

  const kindEntries = useMemo(
    () => entries.filter((e) => e.kind === targetKind),
    [entries, targetKind]
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return kindEntries
      .filter((entry) => {
        if (usePeriodFilter && (entry.dueDate < startDate || entry.dueDate > endDate)) {
          return false;
        }
        const effStatus = getEffectiveEntryStatus(entry, todayStr);
        const pending = getEntryPendingCents(entry);

        if (statusFilter === 'em_aberto') {
          if (entry.status === 'cancelada' || pending <= 0) return false;
        } else if (statusFilter === 'a_vencer') {
          if (entry.status === 'cancelada' || pending <= 0 || effStatus === 'atrasada') {
            return false;
          }
        } else if (statusFilter === 'vencidas') {
          if (effStatus !== 'atrasada') return false;
        } else if (statusFilter !== 'todas') {
          if (effStatus !== statusFilter) return false;
        }

        if (categoryFilter !== 'todas' && entry.categoryId !== categoryFilter) {
          return false;
        }
        if (methodFilter !== 'todas' && entry.paymentMethod !== methodFilter) {
          return false;
        }
        if (clientFilter !== 'todos') {
          if (clientFilter === 'avulsa' && entry.clientId) return false;
          if (clientFilter !== 'avulsa' && entry.clientId !== clientFilter) return false;
        }

        if (q) {
          const clientName = entry.clientId
            ? clientMap.get(entry.clientId)?.companyName || ''
            : '';
          const catName = getCategoryName(categories, entry.categoryId);
          const haystack = [
            entry.description,
            clientName,
            entry.supplierName || '',
            entry.serviceName || '',
            entry.contractCode || '',
            catName,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Vencidos primeiro em contas a receber/pagar
        if (isLedgerMode) {
          const aPend = getEntryPendingCents(a) > 0 ? 0 : 1;
          const bPend = getEntryPendingCents(b) > 0 ? 0 : 1;
          if (aPend !== bPend) return aPend - bPend;
        }
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [
    kindEntries,
    usePeriodFilter,
    startDate,
    endDate,
    todayStr,
    statusFilter,
    categoryFilter,
    methodFilter,
    clientFilter,
    search,
    clientMap,
    categories,
    isLedgerMode,
  ]);

  const summary = useMemo(() => {
    let totalCents = 0;
    let settledCents = 0;
    let pendingCents = 0;
    let overdueCents = 0;

    for (const e of filteredEntries) {
      if (e.status === 'cancelada') continue;
      totalCents += getEntryAllowedTotalCents(e);
      settledCents += e.settledCents || 0;
      const pend = getEntryPendingCents(e);
      pendingCents += pend;
      if (getEffectiveEntryStatus(e, todayStr) === 'atrasada') {
        overdueCents += pend;
      }
    }
    return { totalCents, settledCents, pendingCents, overdueCents };
  }, [filteredEntries, todayStr]);

  const handleExportCsv = () => {
    const csv = buildEntriesCsv(filteredEntries, clients, categories, todayStr);
    const filename = `kaizen-financeiro-${mode}-${todayStr}.csv`;
    triggerCsvDownload(filename, csv);
    onNotify(`CSV exportado: ${filename} (${filteredEntries.length} registros).`);
  };

  const handleCopyBillingSummary = async (entry: FinancialEntry) => {
    const clientName = entry.clientId
      ? clientMap.get(entry.clientId)?.companyName
      : undefined;
    const pending = getEntryPendingCents(entry);
    const text = [
      `Resumo de Cobrança — Agência Kaizen`,
      clientName ? `Cliente: ${clientName}` : null,
      `Referência: ${entry.description}`,
      `Valor em aberto: ${formatBrlFromCents(pending || getEntryAllowedTotalCents(entry))}`,
      `Vencimento: ${formatDateBr(entry.dueDate)}`,
      `Meio de pagamento: ${getPaymentMethodLabel(entry.paymentMethod)}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      onNotify('Resumo de cobrança copiado para a área de transferência.');
    } catch {
      onNotify('Não foi possível copiar automaticamente neste navegador.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingEntry) return;
    setIsCancelling(true);
    try {
      await onCancelEntry(cancellingEntry, cancelReason);
      setCancellingEntry(null);
      setCancelReason('');
    } finally {
      setIsCancelling(false);
    }
  };

  const relevantCategories = categories.filter((c) => c.kind === targetKind);

  return (
    <div className="space-y-5">
      {/* KPIs do recorte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Total Filtrado (Ativos)
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-text-primary)]">
            {formatBrlFromCents(summary.totalCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            {filteredEntries.length} registro(s)
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            {isReceivableSide ? 'Recebido' : 'Pago'}
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-success-text)]">
            {formatBrlFromCents(summary.settledCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            Baixas confirmadas
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] font-medium text-[var(--kz-text-muted)] block">
            Saldo em Aberto
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-info-text)]">
            {formatBrlFromCents(summary.pendingCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            {isReceivableSide ? 'A receber' : 'A pagar'}
          </div>
        </Card>

        <Card
          padding="md"
          className={
            summary.overdueCents > 0
              ? 'border-[var(--kz-danger-border)] bg-[var(--kz-danger-bg)]/30'
              : ''
          }
        >
          <span className="text-[11px] font-semibold text-[var(--kz-danger-text)] block">
            Em Atraso (Vencidos)
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-danger-text)]">
            {formatBrlFromCents(summary.overdueCents)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            Exige ação imediata
          </div>
        </Card>
      </div>

      {/* Barra de filtros & ações */}
      <Card padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => onNewEntry(targetKind)}
            >
              {isReceivableSide ? 'Nova Receita' : 'Nova Despesa'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportCsv}
              disabled={filteredEntries.length === 0}
            >
              Exportar CSV
            </Button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-[var(--kz-text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={usePeriodFilter}
              onChange={(e) => setUsePeriodFilter(e.target.checked)}
              className="rounded border-[var(--kz-border-default)]"
            />
            <span>Restringir ao período do topo ({formatDateBr(startDate)} a {formatDateBr(endDate)})</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Input
            placeholder="Buscar descrição, serviço, cliente..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todas">Todos os status</option>
            <option value="em_aberto">Em aberto (a vencer + atrasadas)</option>
            <option value="a_vencer">A vencer (no prazo)</option>
            <option value="vencidas">Vencidas / Atrasadas</option>
            <option value="prevista">Previstas</option>
            <option value="pendente">Pendentes</option>
            <option
              value={isReceivableSide ? 'parcialmente_recebida' : 'parcialmente_paga'}
            >
              {isReceivableSide ? 'Parcialmente recebidas' : 'Parcialmente pagas'}
            </option>
            <option value={isReceivableSide ? 'recebida' : 'paga'}>
              {isReceivableSide ? 'Recebidas' : 'Pagas'}
            </option>
            <option value="cancelada">Canceladas</option>
          </Select>

          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="todas">Todas as categorias</option>
            {relevantCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="todas">Todas as formas</option>
            {FINANCIAL_PAYMENT_METHOD_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>

          {isReceivableSide ? (
            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="todos">Todos os clientes</option>
              <option value="avulsa">Receitas avulsas</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          ) : (
            <div className="flex items-center text-[11px] text-[var(--kz-text-muted)] px-2">
              {filteredEntries.length} despesa(s) exibida(s)
            </div>
          )}
        </div>
      </Card>

      {/* Tabela */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          title={`Nenhum lançamento em ${
            mode === 'receitas'
              ? 'Receitas'
              : mode === 'despesas'
              ? 'Despesas'
              : mode === 'contas_a_receber'
              ? 'Contas a Receber'
              : 'Contas a Pagar'
          }`}
          description="Ajuste os filtros acima ou cadastre um novo lançamento financeiro real."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => onNewEntry(targetKind)}
            >
              {isReceivableSide ? 'Cadastrar Receita' : 'Cadastrar Despesa'}
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição & Vínculos</TableHead>
                <TableHead>{isReceivableSide ? 'Cliente' : 'Fornecedor'}</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">
                  {isReceivableSide ? 'Recebido' : 'Pago'}
                </TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const effStatus = getEffectiveEntryStatus(entry, todayStr);
                const statusMeta = FINANCIAL_ENTRY_STATUS_META[effStatus];
                const totalCents = getEntryAllowedTotalCents(entry);
                const pendingCents = getEntryPendingCents(entry);
                const daysLate = getDaysOverdue(entry, todayStr);
                const daysUntil = getDaysUntilDue(entry, todayStr);
                const isNearDue =
                  daysUntil !== null && daysUntil >= 0 && daysUntil <= alertDaysAhead;
                const linkedClient = entry.clientId
                  ? clientMap.get(entry.clientId)
                  : undefined;
                const linkedProject = entry.projectId
                  ? projectMap.get(entry.projectId)
                  : undefined;
                const linkedProposal = entry.proposalId
                  ? proposalMap.get(entry.proposalId)
                  : undefined;

                return (
                  <TableRow
                    key={entry.id}
                    className={
                      effStatus === 'atrasada'
                        ? 'bg-[var(--kz-danger-bg)]/20'
                        : isNearDue
                        ? 'bg-[var(--kz-warning-bg)]/15'
                        : ''
                    }
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <div className="text-[var(--kz-text-primary)]">
                        {formatDateBr(entry.dueDate)}
                      </div>
                      {daysLate > 0 && (
                        <div className="text-[10px] font-sans font-semibold text-[var(--kz-danger-text)]">
                          {daysLate}d atraso
                        </div>
                      )}
                      {daysLate === 0 && isNearDue && daysUntil !== null && (
                        <div className="text-[10px] font-sans font-semibold text-[var(--kz-warning-text)]">
                          {daysUntil === 0 ? 'Vence hoje' : `Em ${daysUntil}d`}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="max-w-xs">
                      <div className="font-semibold text-[var(--kz-text-primary)] text-xs truncate">
                        {entry.description}
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                        {getPaymentMethodLabel(entry.paymentMethod)}
                        {entry.serviceName ? ` · ${entry.serviceName}` : ''}
                        {linkedProject ? ` · Proj: ${linkedProject.name}` : ''}
                        {linkedProposal ? ` · Doc: ${linkedProposal.code}` : ''}
                      </div>
                      {entry.attachmentUrl && (
                        <a
                          href={entry.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[var(--kz-accent-text)] hover:underline mt-0.5"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Comprovante / NF
                        </a>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      {isReceivableSide ? (
                        linkedClient ? (
                          onOpenClient ? (
                            <button
                              type="button"
                              onClick={() => onOpenClient(linkedClient.id)}
                              className="text-[var(--kz-accent-text)] hover:underline font-medium text-left cursor-pointer"
                            >
                              {linkedClient.companyName}
                            </button>
                          ) : (
                            linkedClient.companyName
                          )
                        ) : (
                          <span className="text-[var(--kz-text-muted)]">Avulsa</span>
                        )
                      ) : (
                        <span>{entry.supplierName || '—'}</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-[var(--kz-text-secondary)]">
                      {getCategoryName(categories, entry.categoryId)}
                    </TableCell>

                    <TableCell className="text-right font-mono tabular-nums text-xs text-[var(--kz-text-primary)]">
                      {formatBrlFromCents(totalCents)}
                    </TableCell>

                    <TableCell className="text-right font-mono tabular-nums text-xs text-[var(--kz-success-text)]">
                      {formatBrlFromCents(entry.settledCents || 0)}
                    </TableCell>

                    <TableCell className="text-right font-mono tabular-nums text-xs font-bold text-[var(--kz-text-primary)]">
                      {formatBrlFromCents(pendingCents)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {entry.status !== 'cancelada' && (
                          <Button
                            variant={pendingCents > 0 ? 'primary' : 'ghost'}
                            size="xs"
                            leftIcon={<CheckCircle2 className="w-3 h-3" />}
                            onClick={() => onSettleEntry(entry)}
                            title={
                              pendingCents > 0
                                ? isReceivableSide
                                  ? 'Registrar recebimento'
                                  : 'Registrar pagamento'
                                : 'Ver histórico de movimentações'
                            }
                          >
                            {pendingCents > 0
                              ? isReceivableSide
                                ? 'Receber'
                                : 'Pagar'
                              : 'Histórico'}
                          </Button>
                        )}

                        {isReceivableSide && pendingCents > 0 && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleCopyBillingSummary(entry)}
                            title="Copiar resumo de cobrança"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {linkedProposal && onOpenProposal && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onOpenProposal(linkedProposal.id)}
                            title={`Abrir ${linkedProposal.code}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {entry.status !== 'cancelada' && (
                          <>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => onEditEntry(entry)}
                              title="Editar / alterar vencimento"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setCancelReason('');
                                setCancellingEntry(entry);
                              }}
                              className="text-[var(--kz-danger-text)]"
                              title="Cancelar lançamento preservando histórico"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDialog
        isOpen={Boolean(cancellingEntry)}
        onClose={() => setCancellingEntry(null)}
        onConfirm={handleConfirmCancel}
        title="Cancelar Lançamento Financeiro"
        description={
          cancellingEntry
            ? `O lançamento "${cancellingEntry.description}" será marcado como cancelado sem apagar eventuais recebimentos/pagamentos históricos.`
            : ''
        }
        confirmLabel="Confirmar Cancelamento"
        variant="danger"
        loading={isCancelling}
      >
        <Input
          label="Motivo do cancelamento"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Ex: Contrato encerrado ou lançamento duplicado"
        />
      </ConfirmDialog>
    </div>
  );
};
