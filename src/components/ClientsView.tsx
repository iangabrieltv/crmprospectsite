import React, { useMemo, useState } from 'react';
import { Lead, NicheCampaign, AppTab } from '../types/crm';
import {
  AgendaEvent,
  Client,
  ClientStatus,
  CLIENT_STATUS_OPTIONS,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
  getClientStatusMeta,
} from '../types/kaizen';
import { FinancialEntry, FinancialTransaction } from '../types/finance';
import {
  computeClientSummary,
  findDuplicateClient,
} from '../services/clientService';
import { buildWhatsAppLink } from '../utils/phone';
import { ClientFormModal } from './ClientFormModal';
import { ClientDetailModal } from './ClientDetailModal';
import {
  Card,
  Button,
  Badge,
  Input,
  Alert,
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
  Users,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  ArrowRight,
  MessageCircle,
  FileSignature,
  Eye,
  Sparkles,
} from 'lucide-react';

interface ClientsViewProps {
  clients: Client[];
  leads: Lead[];
  niches: NicheCampaign[];
  proposals: ProposalContract[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialChannels?: SocialChannel[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  userName: string;
  cloudPermissionBlocked?: boolean;
  onSaveClient: (client: Client, mode: 'create' | 'edit') => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
  onConvertLeadToClient: (lead: Lead) => Promise<Client>;
  onOpenLeadModal: (lead: Lead) => void;
  onCreateProposalForClient: (client: Client) => void;
  onPreviewProposal: (proposal: ProposalContract) => void;
  onCreateProjectForClient?: (client: Client) => void;
  onOpenProject?: (projectId: string) => void;
  onCreateEventForClient?: (client: Client) => void;
  onOpenSocialModule?: () => void;
  onNavigate: (tab: AppTab) => void;
  externalSelectedClientId?: string | null;
  onClearExternalSelectedClientId?: () => void;
}

const PAGE_SIZE = 10;

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  leads,
  niches,
  proposals,
  projects = [],
  tasks = [],
  agendaEvents = [],
  socialChannels = [],
  socialPosts = [],
  financialEntries = [],
  financialTransactions = [],
  userName,
  cloudPermissionBlocked = false,
  onSaveClient,
  onDeleteClient,
  onConvertLeadToClient,
  onOpenLeadModal,
  onCreateProposalForClient,
  onPreviewProposal,
  onCreateProjectForClient,
  onOpenProject,
  onCreateEventForClient,
  onOpenSocialModule,
  onNavigate,
  externalSelectedClientId = null,
  onClearExternalSelectedClientId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [page, setPage] = useState(1);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClientId, setDetailClientId] = useState<string | null>(
    externalSelectedClientId
  );
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  React.useEffect(() => {
    if (externalSelectedClientId) {
      setDetailClientId(externalSelectedClientId);
    }
  }, [externalSelectedClientId]);

  const summary = useMemo(() => computeClientSummary(clients), [clients]);

  // Leads in stage 'fechado' not yet linked to any Client (deduplicated)
  const pendingClosedLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (lead.stage !== 'fechado') return false;
      const dup = findDuplicateClient(clients, {
        originLeadId: lead.id,
        phone: lead.phone,
        companyName: lead.companyName,
      });
      return !dup;
    });
  }, [leads, clients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        (c.contactName || '').toLowerCase().includes(q) ||
        (c.segment || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.domainName || '').toLowerCase().includes(q) ||
        (c.displayPhone || c.phone || '').toLowerCase().includes(q)
      );
    });
  }, [clients, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedClients = filteredClients.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const activeDetailClient = useMemo(
    () => (detailClientId ? clients.find((c) => c.id === detailClientId) || null : null),
    [clients, detailClientId]
  );

  const handleQuickConvert = async (lead: Lead) => {
    setConvertingLeadId(lead.id);
    try {
      const created = await onConvertLeadToClient(lead);
      setDetailClientId(created.id);
    } finally {
      setConvertingLeadId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">Carteira de Clientes</h2>
          <p className="kz-subtitle">
            Gestão centralizada de clientes ativos, contratos vigentes, infraestrutura e histórico integrado ao CRM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileSignature className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('proposals')}
          >
            Propostas & Contratos
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditingClient(null);
              setIsFormOpen(true);
            }}
          >
            Novo Cliente
          </Button>
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert
          variant="warning"
          title="Sincronização em nuvem pendente de atualização das regras do Firestore"
        >
          O arquivo local <code className="font-mono">firestore.rules</code> já inclui as coleções{' '}
          <code className="font-mono">clients</code> e <code className="font-mono">proposals</code>, mas como a publicação remota foi mantida bloqueada nesta etapa, os dados de Clientes ficam salvos localmente até você publicar as regras atualizadas no Firebase Console.
        </Alert>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-success-text)] flex items-center justify-between">
            <span>Clientes Ativos</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-success-text)]">
            {summary.activeClients}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            {summary.totalClients} cadastrados no total
          </div>
        </Card>

        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-info-text)] flex items-center justify-between">
            <span>Em Onboarding</span>
            <Clock className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-info-text)]">
            {summary.onboardingClients}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            {summary.pausedClients} pausados · {summary.closedClients} encerrados
          </div>
        </Card>

        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-accent-text)] flex items-center justify-between">
            <span>MRR Contratado</span>
            <DollarSign className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-accent-text)]">
            R$ {summary.activeMrr.toLocaleString('pt-BR')}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Soma de clientes ativos e em onboarding
          </div>
        </Card>

        <Card padding="sm" className="flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Setup Contratado</span>
            <Users className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            R$ {summary.contractedSetup.toLocaleString('pt-BR')}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Implantação registrada na carteira ativa
          </div>
        </Card>
      </div>

      {/* Pending CRM Closed Leads Quick Conversion Banner */}
      {pendingClosedLeads.length > 0 && (
        <Card
          padding="md"
          className="border-[var(--kz-accent-border)] bg-[var(--kz-accent-soft)]/35 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--kz-accent)] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                  {pendingClosedLeads.length}{' '}
                  {pendingClosedLeads.length === 1
                    ? 'lead fechado no CRM aguardando conversão em Cliente'
                    : 'leads fechados no CRM aguardando conversão em Cliente'}
                </div>
                <div className="text-[11px] text-[var(--kz-text-muted)]">
                  A conversão importa automaticamente as notas, valores e histórico comercial do lead sem duplicar registros.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pendingClosedLeads.slice(0, 6).map((lead) => (
              <div
                key={lead.id}
                className="p-3 rounded-xl bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--kz-text-primary)] truncate">
                    {lead.companyName}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--kz-text-muted)] truncate">
                    Setup R$ {(lead.creationValue || 0).toLocaleString('pt-BR')} · MRR R${' '}
                    {(lead.monthlyMrr || 0).toLocaleString('pt-BR')}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="xs"
                  loading={convertingLeadId === lead.id}
                  rightIcon={<ArrowRight className="w-3 h-3" />}
                  onClick={() => handleQuickConvert(lead)}
                >
                  Converter
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="w-full lg:max-w-sm">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por empresa, contato, domínio, cidade..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] border-[var(--kz-accent)]'
                : 'bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            Todos ({clients.length})
          </button>
          {CLIENT_STATUS_OPTIONS.map((opt) => {
            const count = clients.filter((c) => c.status === opt.id).length;
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
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
      {filteredClients.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title={
            clients.length === 0
              ? 'Nenhum cliente cadastrado ainda'
              : 'Nenhum cliente corresponde aos filtros atuais'
          }
          description={
            clients.length === 0
              ? 'Cadastre seu primeiro cliente manualmente ou converta um lead fechado direto do CRM.'
              : 'Ajuste os termos da busca ou limpe o filtro de status para visualizar todos os clientes.'
          }
          action={
            clients.length === 0 ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditingClient(null);
                  setIsFormOpen(true);
                }}
              >
                Cadastrar Primeiro Cliente
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
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
                  <TableHead>Empresa / Segmento</TableHead>
                  <TableHead>Contato & Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Domínio / Origem</TableHead>
                  <TableHead className="text-right">Setup</TableHead>
                  <TableHead className="text-right">MRR / mês</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client) => {
                  const sMeta = getClientStatusMeta(client.status);
                  const linkedProposalsCount = proposals.filter(
                    (p) =>
                      p.clientId === client.id ||
                      (client.originLeadId && p.leadId === client.originLeadId)
                  ).length;

                  return (
                    <TableRow
                      key={client.id}
                      onClick={() => setDetailClientId(client.id)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="font-semibold text-[var(--kz-text-primary)]">
                          {client.companyName}
                        </div>
                        <div className="text-[11px] text-[var(--kz-text-muted)]">
                          {client.segment || 'Serviços Digitais'}
                          {linkedProposalsCount > 0 &&
                            ` · ${linkedProposalsCount} doc${
                              linkedProposalsCount > 1 ? 's' : ''
                            }`}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-[var(--kz-text-secondary)]">
                          {client.contactName || '—'}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                          {client.displayPhone || client.phone || '—'}
                          {client.city ? ` · ${client.city}` : ''}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={sMeta.variant} dot>
                          {sMeta.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-mono text-[var(--kz-text-secondary)]">
                          {client.domainName || 'Sem domínio'}
                        </div>
                        <div className="text-[11px] text-[var(--kz-text-muted)]">
                          {client.originLeadId ? 'Convertido do CRM' : 'Cadastro direto'}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums text-xs text-[var(--kz-text-secondary)]">
                        R$ {(client.setupValue || 0).toLocaleString('pt-BR')}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums text-xs font-bold text-[var(--kz-success-text)]">
                        R$ {(client.monthlyMrr || 0).toLocaleString('pt-BR')}
                      </TableCell>

                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {client.phone && (
                            <a
                              href={buildWhatsAppLink(
                                client.phone,
                                `Olá ${client.contactName || client.companyName}, tudo bem?`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] hover:bg-emerald-500/20 transition-colors"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setDetailClientId(client.id)}
                          >
                            Ficha
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
            totalItems={filteredClients.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <ClientFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingClient(null);
          }}
          existingClients={clients}
          leads={leads}
          niches={niches}
          userName={userName}
          initialClient={editingClient}
          onSaveClient={onSaveClient}
          onOpenExistingClient={(existing) => setDetailClientId(existing.id)}
        />
      )}

      {/* Detail Dossier Modal */}
      {activeDetailClient && (
        <ClientDetailModal
          client={activeDetailClient}
          leads={leads}
          proposals={proposals}
          projects={projects}
          tasks={tasks}
          agendaEvents={agendaEvents}
          socialChannels={socialChannels}
          socialPosts={socialPosts}
          financialEntries={financialEntries}
          financialTransactions={financialTransactions}
          userName={userName}
          onClose={() => {
            setDetailClientId(null);
            onClearExternalSelectedClientId?.();
          }}
          onEditClient={(cli) => {
            setEditingClient(cli);
            setIsFormOpen(true);
          }}
          onUpdateClient={async (updated) => {
            await onSaveClient(updated, 'edit');
          }}
          onDeleteClient={onDeleteClient}
          onOpenLeadModal={onOpenLeadModal}
          onCreateProposalForClient={onCreateProposalForClient}
          onPreviewProposal={onPreviewProposal}
          onCreateProjectForClient={onCreateProjectForClient}
          onOpenProject={onOpenProject}
          onCreateEventForClient={onCreateEventForClient}
          onOpenSocialModule={onOpenSocialModule}
          onOpenFinance={() => onNavigate('finance')}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
