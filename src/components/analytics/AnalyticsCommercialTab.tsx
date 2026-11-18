import React from 'react';
import { ArrowRight, Clock, FileSignature, Target, Users } from 'lucide-react';
import { AppTab } from '../../types/crm';
import { AnalyticsPreferences } from '../../types/analytics';
import { CommercialAnalyticsSnapshot } from '../../services/analytics';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';
import {
  AnalyticsKpiCard,
  DataLimitationBanner,
  DualBarTimeSeriesChart,
  HorizontalBarBreakdown,
} from './AnalyticsCharts';

interface AnalyticsCommercialTabProps {
  commercial: CommercialAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
  onNavigateTab: (tab: AppTab) => void;
}

export const AnalyticsCommercialTab: React.FC<AnalyticsCommercialTabProps> = ({
  commercial,
  preferences,
  onNavigateTab,
}) => {
  const leadsDelta = commercial.leadsCreatedInPeriod - commercial.previousLeadsCreatedInPeriod;
  const propsDelta =
    commercial.proposalsApprovedOrSignedInPeriod -
    commercial.previousProposalsApprovedOrSignedInPeriod;

  const conversionList = [
    commercial.conversions.leadToContacted,
    commercial.conversions.contactedToMeeting,
    commercial.conversions.meetingToClosed,
    commercial.conversions.leadToClosedOverall,
    commercial.conversions.proposalApprovalRate,
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Comerciais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <AnalyticsKpiCard
          label="Leads Criados no Período"
          value={String(commercial.leadsCreatedInPeriod)}
          subtitle={`Base filtrada: ${commercial.totalLeadsBase} · Sem contato: ${commercial.leadsUncontactedInBase}`}
          deltaText={`${leadsDelta > 0 ? '+' : ''}${leadsDelta} vs anterior`}
          deltaPositive={leadsDelta === 0 ? null : leadsDelta > 0}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Leads Contatados no Período"
          value={String(commercial.leadsContactedInPeriod)}
          subtitle={`Em follow-up na base: ${commercial.followUpActiveCount}`}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Reuniões Agendadas / Realizadas"
          value={`${commercial.meetingsScheduledInPeriod} / ${commercial.meetingsRealizedInPeriod}`}
          subtitle="Consolidado de Leads CRM + Agenda"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Propostas Aprovadas / Assinadas"
          value={String(commercial.proposalsApprovedOrSignedInPeriod)}
          subtitle={`MRR: R$ ${commercial.proposalsApprovedMrrInPeriod.toLocaleString(
            'pt-BR'
          )} · Recusadas: ${commercial.proposalsRefusedInPeriod}`}
          deltaText={`${propsDelta > 0 ? '+' : ''}${propsDelta} vs anterior`}
          deltaPositive={propsDelta === 0 ? null : propsDelta > 0}
          tone="success"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Tempo Médio até Fechamento"
          value={
            commercial.avgDaysToClose.valueDays !== null
              ? `${commercial.avgDaysToClose.valueDays} dias`
              : 'Sem amostra'
          }
          subtitle={commercial.avgDaysToClose.basisDescription}
          tone={commercial.avgDaysToClose.valueDays !== null ? 'accent' : 'default'}
          compact={preferences.compactTables}
        />
      </div>

      {/* Conversões Explícitas (Numerador / Denominador) */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--kz-accent)]" />
            <div>
              <CardTitle>Taxas de Conversão com Amostra Explícita</CardTitle>
              <CardDescription>
                Nenhuma taxa é estimada sem denominador válido (exibe — quando amostra = 0).
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onNavigateTab('kanban')}
            >
              Abrir CRM
            </Button>
            <Button
              variant="outline"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onNavigateTab('proposals')}
            >
              Propostas
            </Button>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {conversionList.map((conv) => (
            <div
              key={conv.id}
              className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)] space-y-1"
            >
              <span className="text-[11px] text-[var(--kz-text-muted)] block leading-snug">
                {conv.label}
              </span>
              <div className="text-lg kz-metric text-[var(--kz-accent-text)]">
                {conv.ratePct !== null ? `${conv.ratePct}%` : '—'}
              </div>
              <div className="text-[11px] font-mono text-[var(--kz-text-secondary)]">
                Base: {conv.ratioText}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Evolução Temporal & Pipeline de Propostas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="lg:col-span-2 space-y-3">
          <CardHeader>
            <div>
              <CardTitle>Evolução de Prospecção no Período</CardTitle>
              <CardDescription>
                Comparativo por janela entre leads cadastrados e abordagens registradas.
              </CardDescription>
            </div>
          </CardHeader>
          <DualBarTimeSeriesChart
            points={commercial.timeSeries.map((pt) => ({
              key: pt.key,
              label: pt.label,
              valueA: pt.leadsCreated,
              valueB: pt.leadsContacted,
            }))}
            labelA="Leads Cadastrados"
            labelB="Contatos Realizados"
            colorA="#C6A15B"
            colorB="#38BDF8"
            emptyMessage="Sem movimentação comercial nesta janela."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-[var(--kz-accent)]" />
              <CardTitle>Pipeline de Propostas</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[var(--kz-text-muted)]">Propostas criadas (período)</span>
              <span className="font-mono font-bold text-[var(--kz-text-primary)]">
                {commercial.proposalsCreatedInPeriod}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[var(--kz-text-muted)]">Enviadas no período</span>
              <span className="font-mono font-bold text-[var(--kz-text-primary)]">
                {commercial.proposalsSentInPeriod}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[var(--kz-text-muted)]">Em negociação (abertas)</span>
              <span className="font-mono font-bold text-[var(--kz-accent-text)]">
                {commercial.proposalsOpenPipelineCount}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[var(--kz-text-muted)]">Setup em aberto</span>
              <span className="font-mono font-bold text-[var(--kz-text-primary)]">
                R$ {commercial.proposalsOpenPipelineSetup.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[var(--kz-text-muted)]">MRR em negociação</span>
              <span className="font-mono font-bold text-[var(--kz-success-text)]">
                R$ {commercial.proposalsOpenPipelineMrr.toLocaleString('pt-BR')}/mês
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--kz-text-muted)]">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Setup aprovado no período: R${' '}
                {commercial.proposalsApprovedSetupInPeriod.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Funil das 8 Etapas */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div>
            <CardTitle>Distribuição Completa do Funil CRM (8 Etapas)</CardTitle>
            <CardDescription>
              Total na base vs leads com atividade (criação, contato ou atualização) no período.
            </CardDescription>
          </div>
          <Badge variant="neutral" size="md">
            <Users className="w-3 h-3" /> {commercial.totalLeadsBase} leads
          </Badge>
        </CardHeader>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Total na Etapa</TableHead>
                <TableHead className="text-right">Atividade no Período</TableHead>
                <TableHead className="text-right">% da Base</TableHead>
                <TableHead className="text-right">Setup Estimado</TableHead>
                <TableHead className="text-right">MRR Estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono tabular-nums">
              {commercial.funnelStages.map((stage) => (
                <TableRow key={stage.stageId}>
                  <TableCell
                    className={`font-sans font-medium text-[var(--kz-text-primary)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {stage.stageName}
                  </TableCell>
                  <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                    {stage.countTotal}
                  </TableCell>
                  <TableCell
                    className={`text-right text-[var(--kz-accent-text)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    {stage.countInPeriod}
                  </TableCell>
                  <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                    {stage.percentOfPipeline !== null ? `${stage.percentOfPipeline}%` : '0%'}
                  </TableCell>
                  <TableCell className={`text-right ${preferences.compactTables ? 'py-2' : ''}`}>
                    R$ {stage.estimatedCreationTotal.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell
                    className={`text-right text-[var(--kz-success-text)] ${
                      preferences.compactTables ? 'py-2' : ''
                    }`}
                  >
                    R$ {stage.estimatedMrrTotal.toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Quebras por Nicho, Cidade e Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="lg:col-span-1 space-y-3">
          <CardHeader>
            <CardTitle>Por Campanha / Nicho</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={commercial.byNiche.map((n) => ({
              key: n.nicheId,
              label: n.nicheName,
              value: n.totalLeads,
              formattedValue: `${n.totalLeads}`,
              secondaryText:
                n.closingRatePct !== null
                  ? `${n.closedCount} fech. (${n.closingRatePct}%)`
                  : `${n.closedCount} fech.`,
              tone: n.closedCount > 0 ? 'success' : 'accent',
            }))}
            emptyMessage="Nenhuma campanha com leads neste filtro."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Por Cidade</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={commercial.byCity.map((c) => ({
              key: c.label,
              label: c.label,
              value: c.total,
              secondaryText:
                c.closingRatePct !== null
                  ? `${c.closed} fech. (${c.closingRatePct}%)`
                  : undefined,
              tone: 'accent',
            }))}
            emptyMessage="Sem cidades registradas nos leads."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Por Categoria</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={commercial.byCategory.map((c) => ({
              key: c.label,
              label: c.label,
              value: c.total,
              secondaryText:
                c.closingRatePct !== null
                  ? `${c.closed} fech. (${c.closingRatePct}%)`
                  : undefined,
              tone: 'neutral',
            }))}
            emptyMessage="Sem categorias registradas nos leads."
          />
        </Card>
      </div>

      <DataLimitationBanner
        visible={preferences.showDataLimitationsNotice}
        title="Origem dos Leads"
        message={commercial.dataLimitationsNote}
      />
    </div>
  );
};
