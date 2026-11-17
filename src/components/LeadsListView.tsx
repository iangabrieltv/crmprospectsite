import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  Plus,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Star,
  Calendar,
  PhoneCall,
} from 'lucide-react';
import {
  Lead,
  NicheCampaign,
  FUNNEL_STAGES,
  FunnelStageId,
  normalizeStageId,
} from '../types/crm';
import {
  buildWhatsAppLink,
  formatFriendlyTime,
  getStageWhatsAppMessage,
  isInactiveOver48h,
} from '../utils/phone';
import {
  Card,
  Input,
  Select,
  Button,
  Badge,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  EmptyState,
} from './ui';

interface LeadsListViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  onMoveStage: (leadId: string, targetStage: FunnelStageId) => void;
  onOpenLeadModal: (lead: Lead) => void;
  onOpenNewLeadModal: (defaultStage?: FunnelStageId) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onSwitchToImporter?: () => void;
}

const PAGE_SIZE = 15;

export const LeadsListView: React.FC<LeadsListViewProps> = ({
  niche,
  leads,
  onMoveStage,
  onOpenLeadModal,
  onOpenNewLeadModal,
  onFastWhatsAppContacted,
  onSwitchToImporter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | FunnelStageId>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.city?.trim()) set.add(l.city.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return leads
      .filter((lead) => {
        if (q) {
          const match =
            lead.companyName.toLowerCase().includes(q) ||
            lead.phone.toLowerCase().includes(q) ||
            lead.displayPhone.toLowerCase().includes(q) ||
            (lead.contactName || '').toLowerCase().includes(q) ||
            (lead.city || '').toLowerCase().includes(q) ||
            (lead.category || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        if (stageFilter !== 'all' && normalizeStageId(lead.stage) !== stageFilter) {
          return false;
        }
        if (cityFilter !== 'all' && (lead.city || '').trim() !== cityFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
        const bTime = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [leads, searchTerm, stageFilter, cityFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stageFilter, cityFilter, niche.id]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = filteredLeads.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleCopyPhone = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(lead.displayPhone || lead.phone);
    setCopiedLeadId(lead.id);
    setTimeout(() => {
      setCopiedLeadId((prev) => (prev === lead.id ? null : prev));
    }, 1500);
  };

  const getStageBadgeVariant = (stageId: FunnelStageId) => {
    switch (stageId) {
      case 'fechado':
      case 'reuniao_marcada':
        return 'success' as const;
      case 'nao_atendida':
        return 'warning' as const;
      case 'primeiro_contato':
      case 'mandei_mensagem':
        return 'info' as const;
      case 'follow_up_1':
      case 'follow_up_2':
        return 'accent' as const;
      default:
        return 'neutral' as const;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
      {/* Toolbar Card */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar empresa, telefone, cidade, categoria..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />

            <Select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as 'all' | FunnelStageId)}
              aria-label="Filtrar por etapa do funil"
            >
              <option value="all">Todas as etapas ({leads.length})</option>
              {FUNNEL_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>

            <Select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Filtrar por cidade"
            >
              <option value="all">Todas as cidades ({uniqueCities.length})</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSwitchToImporter && (
              <Button variant="outline" size="md" onClick={onSwitchToImporter}>
                Importar Planilha
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => onOpenNewLeadModal('leads_sem_contato')}
            >
              Novo Lead
            </Button>
          </div>
        </div>
      </Card>

      {filteredLeads.length === 0 ? (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title="Nenhum lead encontrado com os filtros atuais"
          description={
            leads.length === 0
              ? `A campanha ${niche.name} ainda não possui leads. Cadastre um novo lead ou importe uma planilha.`
              : 'Tente limpar a busca ou selecionar outra etapa ou cidade.'
          }
          action={
            <>
              {(searchTerm || stageFilter !== 'all' || cityFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStageFilter('all');
                    setCityFilter('all');
                  }}
                >
                  Limpar filtros
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => onOpenNewLeadModal('leads_sem_contato')}
              >
                Novo Lead
              </Button>
            </>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Empresa / Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Etapa do Funil</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Receita (Setup / MRR)</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((lead) => {
                    const normStage = normalizeStageId(lead.stage);
                    const stageMeta = FUNNEL_STAGES.find((s) => s.id === normStage);
                    const inactive =
                      normStage !== 'fechado' &&
                      isInactiveOver48h(lead.lastContactDate, lead.createdAt);
                    const waHref = buildWhatsAppLink(
                      lead.phone,
                      getStageWhatsAppMessage(lead.contactName || lead.companyName, normStage)
                    );

                    return (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => onOpenLeadModal(lead)}
                      >
                        <TableCell>
                          <div className="space-y-0.5 max-w-[260px]">
                            <div className="font-semibold text-[var(--kz-text-primary)] truncate flex items-center gap-1.5">
                              <span className="truncate">{lead.companyName}</span>
                              {lead.googleRating ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-[var(--kz-warning-text)] shrink-0">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  {lead.googleRating}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                              {lead.contactName || lead.category || 'Sem contato definido'}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span>{lead.displayPhone || lead.phone}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(lead, e)}
                              className="p-1 rounded hover:bg-[var(--kz-bg-subtle)] text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] cursor-pointer"
                              title="Copiar telefone"
                            >
                              {copiedLeadId === lead.id ? (
                                <Check className="w-3 h-3 text-[var(--kz-success-solid)]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--kz-text-secondary)]">
                            <MapPin className="w-3 h-3 text-[var(--kz-text-subtle)] shrink-0" />
                            <span className="truncate max-w-[130px]">
                              {lead.city || niche.city}
                            </span>
                          </span>
                        </TableCell>

                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <select
                            value={normStage}
                            onChange={(e) =>
                              onMoveStage(lead.id, e.target.value as FunnelStageId)
                            }
                            aria-label={`Alterar etapa de ${lead.companyName}`}
                            className="h-7 px-2 text-[11px] font-semibold rounded-md border border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]"
                          >
                            {FUNNEL_STAGES.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.shortName}
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] text-[var(--kz-text-secondary)]">
                              {lead.lastContactDate
                                ? formatFriendlyTime(lead.lastContactDate)
                                : 'Ainda não contatado'}
                            </span>
                            {inactive && (
                              <Badge variant="warning" size="sm">
                                +48h inativo
                              </Badge>
                            )}
                            {lead.meetingDate && lead.meetingStatus !== 'cancelada' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--kz-success-text)] font-medium">
                                <Calendar className="w-3 h-3" />
                                {lead.meetingDate.split('-').reverse().join('/')}
                              </span>
                            )}
                            {lead.callbackDate && lead.callbackStatus === 'pendente' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--kz-warning-text)] font-medium">
                                <PhoneCall className="w-3 h-3" />
                                Retorno {lead.callbackDate.split('-').reverse().join('/')}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {lead.creationValue || lead.monthlyMrr ? (
                            <div className="space-y-0.5">
                              {lead.creationValue ? (
                                <div className="text-[11px] text-[var(--kz-text-primary)]">
                                  R$ {lead.creationValue.toLocaleString('pt-BR')}
                                </div>
                              ) : null}
                              {lead.monthlyMrr ? (
                                <div className="text-[10px] font-semibold text-[var(--kz-success-text)]">
                                  R$ {lead.monthlyMrr.toLocaleString('pt-BR')}/mês
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[var(--kz-text-subtle)]">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {waHref !== '#' && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => onFastWhatsAppContacted(lead)}
                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] hover:bg-emerald-500/20 text-[11px] font-semibold transition-colors"
                                title="Enviar WhatsApp e registrar contato"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              rightIcon={<ExternalLink className="w-3 h-3" />}
                              onClick={() => onOpenLeadModal(lead)}
                            >
                              Abrir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden divide-y divide-[var(--kz-border-subtle)]">
            {paginatedLeads.map((lead) => {
              const normStage = normalizeStageId(lead.stage);
              const stageMeta = FUNNEL_STAGES.find((s) => s.id === normStage);
              const waHref = buildWhatsAppLink(
                lead.phone,
                getStageWhatsAppMessage(lead.contactName || lead.companyName, normStage)
              );

              return (
                <div
                  key={lead.id}
                  onClick={() => onOpenLeadModal(lead)}
                  className="p-3.5 space-y-2.5 hover:bg-[var(--kz-bg-subtle)]/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--kz-text-primary)] truncate">
                        {lead.companyName}
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                        {lead.city || niche.city} · {lead.displayPhone || lead.phone}
                      </div>
                    </div>
                    <Badge variant={getStageBadgeVariant(normStage)} size="sm">
                      {stageMeta?.shortName || normStage}
                    </Badge>
                  </div>

                  <div
                    className="flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={normStage}
                      onChange={(e) =>
                        onMoveStage(lead.id, e.target.value as FunnelStageId)
                      }
                      className="h-7 px-2 text-[11px] font-semibold rounded-md border border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)]"
                    >
                      {FUNNEL_STAGES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.shortName}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5">
                      {waHref !== '#' && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onFastWhatsAppContacted(lead)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] text-[11px] font-semibold"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onOpenLeadModal(lead)}
                      >
                        Abrir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 bg-[var(--kz-bg-surface)]">
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredLeads.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        </Card>
      )}
    </div>
  );
};
