import React, { useMemo, useState } from 'react';
import { Lead, NicheCampaign, AppTab } from '../types/crm';
import {
  Client,
  DocumentKind,
  PROPOSAL_STATUS_OPTIONS,
  ProposalContract,
  ProposalStatus,
  getProposalStatusMeta,
} from '../types/kaizen';
import { FinancialEntry, FinancialRecurrence } from '../types/finance';
import { ModelTemplate } from '../types/resources';
import { SystemSettings } from '../types/system';
import { BuildProposalFinancialInput } from '../services/finance';
import { computeProposalsSummary } from '../services/proposalService';
import { downloadProposalPdf } from '../services/pdfService';
import { getIssuerBrandingFromSettings } from '../services/system/settingsService';
import { ProposalModal } from './ProposalModal';
import { ProposalPreviewModal } from './ProposalPreviewModal';
import {
  Card,
  Button,
  Badge,
  Input,
  Alert,
  Tabs,
  EmptyState,
  Pagination,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui';
import {
  FileSignature,
  Plus,
  Search,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  ScrollText,
  Library,
} from 'lucide-react';

interface ProposalsViewProps {
  proposals: ProposalContract[];
  clients: Client[];
  leads: Lead[];
  niches: NicheCampaign[];
  financialEntries?: FinancialEntry[];
  financialRecurrences?: FinancialRecurrence[];
  modelTemplates?: ModelTemplate[];
  systemSettings?: SystemSettings | null;
  userName: string;
  cloudPermissionBlocked?: boolean;
  initialDraftSource?: {
    client?: Client | null;
    lead?: Lead | null;
    kind?: DocumentKind;
  } | null;
  onClearInitialDraftSource?: () => void;
  previewProposalIdExternal?: string | null;
  onClearPreviewProposalIdExternal?: () => void;
  onSaveProposal: (proposal: ProposalContract, mode: 'create' | 'edit') => Promise<void>;
  onDeleteProposal: (proposalId: string) => Promise<void>;
  onTransitionStatus: (
    proposal: ProposalContract,
    nextStatus: ProposalStatus,
    note?: string
  ) => Promise<void>;
  onApproveAndSyncClient: (proposal: ProposalContract) => Promise<Client>;
  onGenerateFinancialForecast?: (
    input: Omit<BuildProposalFinancialInput, 'actor'>
  ) => Promise<{ createdEntriesCount: number; createdRecurrencesCount: number }>;
  onNavigate: (tab: AppTab) => void;
  onOpenTemplatesLibrary?: () => void;
  onOpenClientFromProposal?: (client: Client) => void;
}

const PAGE_SIZE = 10;

export const ProposalsView: React.FC<ProposalsViewProps> = ({
  proposals,
  clients,
  leads,
  niches,
  financialEntries = [],
  financialRecurrences = [],
  modelTemplates = [],
  systemSettings = null,
  userName,
  cloudPermissionBlocked = false,
  initialDraftSource = null,
  onClearInitialDraftSource,
  previewProposalIdExternal = null,
  onClearPreviewProposalIdExternal,
  onSaveProposal,
  onDeleteProposal,
  onTransitionStatus,
  onApproveAndSyncClient,
  onGenerateFinancialForecast,
  onNavigate,
  onOpenTemplatesLibrary,
  onOpenClientFromProposal,
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | DocumentKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProposalStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialDraftSource));
  const [draftKind, setDraftKind] = useState<DocumentKind>(
    initialDraftSource?.kind || 'proposta'
  );
  const [editingProposal, setEditingProposal] = useState<ProposalContract | null>(null);
  const [previewProposalId, setPreviewProposalId] = useState<string | null>(
    previewProposalIdExternal
  );

  // Sync external preview/draft requests when props update while mounted
  React.useEffect(() => {
    if (initialDraftSource) {
      setEditingProposal(null);
      setDraftKind(initialDraftSource.kind || 'proposta');
      setIsModalOpen(true);
    }
  }, [initialDraftSource]);

  React.useEffect(() => {
    if (previewProposalIdExternal) {
      setPreviewProposalId(previewProposalIdExternal);
    }
  }, [previewProposalIdExternal]);

  const summary = useMemo(() => computeProposalsSummary(proposals), [proposals]);
  const issuerBranding = useMemo(
    () => getIssuerBrandingFromSettings(systemSettings, userName),
    [systemSettings, userName]
  );

  const filteredProposals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return proposals.filter((p) => {
      if (kindFilter !== 'all' && p.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.recipientCompany.toLowerCase().includes(q) ||
        (p.recipientContact || '').toLowerCase().includes(q)
      );
    });
  }, [proposals, kindFilter, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProposals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProposals = filteredProposals.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const activePreviewProposal = useMemo(
    () =>
      previewProposalId
        ? proposals.find((p) => p.id === previewProposalId) || null
        : null,
    [proposals, previewProposalId]
  );

  const handleCloseForm = () => {
    setIsModalOpen(false);
    setEditingProposal(null);
    onClearInitialDraftSource?.();
  };

  const handleClosePreview = () => {
    setPreviewProposalId(null);
    onClearPreviewProposalIdExternal?.();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">Propostas & Contratos</h2>
          <p className="kz-subtitle">
            Criação estruturada de propostas comerciais e contratos com acompanhamento de status e exportação em PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenTemplatesLibrary && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Library className="w-3.5 h-3.5" />}
              onClick={onOpenTemplatesLibrary}
            >
              Biblioteca de Modelos
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Users className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('clients')}
          >
            Clientes
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ScrollText className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditingProposal(null);
              setDraftKind('contrato');
              setIsModalOpen(true);
            }}
          >
            Novo Contrato
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditingProposal(null);
              setDraftKind('proposta');
              setIsModalOpen(true);
            }}
          >
            Nova Proposta
          </Button>
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert
          variant="warning"
          title="Sincronização em nuvem pendente de atualização das regras do Firestore"
        >
          O arquivo local <code className="font-mono">firestore.rules</code> já contempla a coleção{' '}
          <code className="font-mono">proposals</code>, mas como a publicação remota foi bloqueada nesta etapa, os documentos ficam persistidos localmente até você publicar as regras atualizadas no Firebase Console.
        </Alert>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-info-text)] flex items-center justify-between">
            <span>Propostas em Aberto</span>
            <Clock className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-info-text)]">
            {summary.sentOrNegotiatingCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
            Setup R$ {summary.openPipelineSetup.toLocaleString('pt-BR')} · MRR R${' '}
            {summary.openPipelineMrr.toLocaleString('pt-BR')}
          </div>
        </Card>

        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-success-text)] flex items-center justify-between">
            <span>Aprovadas / Assinadas</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-success-text)]">
            {summary.approvedCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
            Setup R$ {summary.approvedSetup.toLocaleString('pt-BR')} · MRR R${' '}
            {summary.approvedMrr.toLocaleString('pt-BR')}
          </div>
        </Card>

        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-accent-text)] flex items-center justify-between">
            <span>Taxa de Aprovação</span>
            <TrendingUp className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-accent-text)]">
            {summary.approvalRatePercent}%
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Sobre propostas com desfecho comercial
          </div>
        </Card>

        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Total de Documentos</span>
            <FileSignature className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {summary.totalCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            {proposals.filter((p) => p.kind === 'proposta').length} propostas ·{' '}
            {proposals.filter((p) => p.kind === 'contrato').length} contratos
          </div>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <Tabs
            activeId={kindFilter}
            onChange={(id) => {
              setKindFilter(id);
              setPage(1);
            }}
            items={[
              { id: 'all', label: 'Todos', badge: proposals.length },
              {
                id: 'proposta',
                label: 'Propostas',
                badge: proposals.filter((p) => p.kind === 'proposta').length,
              },
              {
                id: 'contrato',
                label: 'Contratos',
                badge: proposals.filter((p) => p.kind === 'contrato').length,
              },
            ]}
          />

          <div className="w-full lg:max-w-sm">
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por código (KZ-P), título ou empresa..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border-[var(--kz-accent)]'
                : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            Todos os status
          </button>
          {PROPOSAL_STATUS_OPTIONS.map((opt) => {
            const count = proposals.filter((p) => p.status === opt.id).length;
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border-[var(--kz-accent)]'
                    : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-subtle)]'
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List / Empty State */}
      {filteredProposals.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="w-5 h-5" />}
          title={
            proposals.length === 0
              ? 'Nenhuma proposta ou contrato criado ainda'
              : 'Nenhum documento corresponde aos filtros atuais'
          }
          description={
            proposals.length === 0
              ? 'Crie uma proposta comercial ou contrato diretamente aqui, ou gere a partir de qualquer lead no CRM.'
              : 'Ajuste a busca ou selecione outro status para listar seus documentos.'
          }
          action={
            proposals.length === 0 ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditingProposal(null);
                  setDraftKind('proposta');
                  setIsModalOpen(true);
                }}
              >
                Criar Primeira Proposta
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setKindFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                  setPage(1);
                }}
              >
                Limpar Filtros
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Código</TableHead>
                  <TableHead>Documento / Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Setup</TableHead>
                  <TableHead className="text-right">MRR / mês</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProposals.map((prop) => {
                  const sMeta = getProposalStatusMeta(prop.status);
                  return (
                    <TableRow
                      key={prop.id}
                      onClick={() => setPreviewProposalId(prop.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs font-bold text-[var(--kz-accent-text)] whitespace-nowrap">
                        {prop.code}
                      </TableCell>

                      <TableCell>
                        <div className="font-semibold text-[var(--kz-text-primary)]">
                          {prop.recipientCompany}
                        </div>
                        <div className="text-[11px] text-[var(--kz-text-muted)] truncate max-w-xs">
                          {prop.title}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-[var(--kz-text-secondary)]">
                        {prop.kind === 'contrato' ? 'Contrato' : 'Proposta'}
                      </TableCell>

                      <TableCell>
                        <Badge variant={sMeta.variant} dot>
                          {sMeta.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums text-xs text-[var(--kz-text-secondary)]">
                        R$ {(prop.setupTotal || 0).toLocaleString('pt-BR')}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums text-xs font-bold text-[var(--kz-success-text)]">
                        R$ {(prop.monthlyMrr || 0).toLocaleString('pt-BR')}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-[var(--kz-text-muted)] whitespace-nowrap">
                        {prop.validUntil
                          ? prop.validUntil.split('-').reverse().join('/')
                          : '—'}
                      </TableCell>

                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="xs"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setPreviewProposalId(prop.id)}
                          >
                            Abrir
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            leftIcon={<Download className="w-3.5 h-3.5" />}
                            onClick={() => downloadProposalPdf(prop, issuerBranding)}
                          >
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={filteredProposals.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {isModalOpen && (
        <ProposalModal
          isOpen={isModalOpen}
          onClose={handleCloseForm}
          existingProposals={proposals}
          clients={clients}
          leads={leads}
          niches={niches}
          modelTemplates={modelTemplates}
          systemSettings={systemSettings}
          userName={userName}
          initialProposal={editingProposal}
          initialClient={editingProposal ? null : initialDraftSource?.client || null}
          initialLead={editingProposal ? null : initialDraftSource?.lead || null}
          initialKind={editingProposal ? editingProposal.kind : draftKind}
          onSaveProposal={onSaveProposal}
        />
      )}

      {activePreviewProposal && (
        <ProposalPreviewModal
          proposal={activePreviewProposal}
          clients={clients}
          financialEntries={financialEntries}
          financialRecurrences={financialRecurrences}
          systemSettings={systemSettings}
          onClose={handleClosePreview}
          onEdit={(prop) => {
            setEditingProposal(prop);
            setIsModalOpen(true);
          }}
          onDelete={onDeleteProposal}
          onTransitionStatus={onTransitionStatus}
          onApproveAndSyncClient={onApproveAndSyncClient}
          onOpenClient={onOpenClientFromProposal}
          onGenerateFinancialForecast={onGenerateFinancialForecast}
          onOpenFinance={() => onNavigate('finance')}
        />
      )}
    </div>
  );
};
