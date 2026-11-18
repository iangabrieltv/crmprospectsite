import React from 'react';
import { AlertTriangle, ArrowRight, Share2 } from 'lucide-react';
import { AppTab } from '../../types/crm';
import { AnalyticsPreferences } from '../../types/analytics';
import { SocialAnalyticsSnapshot } from '../../services/analytics';
import { formatDateBr } from '../../services/finance/money';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
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

interface AnalyticsSocialTabProps {
  social: SocialAnalyticsSnapshot;
  preferences: AnalyticsPreferences;
  onNavigateTab: (tab: AppTab) => void;
}

export const AnalyticsSocialTab: React.FC<AnalyticsSocialTabProps> = ({
  social,
  preferences,
  onNavigateTab,
}) => {
  const pubDelta = social.publishedInPeriodCount - social.previousPublishedInPeriodCount;

  return (
    <div className="space-y-6">
      {/* Aviso obrigatório de ausência de métricas externas */}
      <DataLimitationBanner
        alwaysShow
        title="Escopo Editorial — Métricas Externas Não Conectadas"
        message={social.externalMetricsLimitationNote}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <AnalyticsKpiCard
          label="Canais Ativos"
          value={String(social.activeChannelsCount)}
          subtitle={`Total canais cadastrados: ${social.totalChannels}`}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Planejados no Período"
          value={String(social.plannedInPeriodCount)}
          subtitle={`Kaizen: ${social.kaizenPostsInPeriod} · Clientes: ${social.clientPostsInPeriod}`}
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Publicados no Período"
          value={String(social.publishedInPeriodCount)}
          subtitle={
            social.publicationComplianceRatePct !== null
              ? `Cumprimento: ${social.publicationComplianceRatePct}% do planejado`
              : 'Sem publicações planejadas no período'
          }
          deltaText={`${pubDelta > 0 ? '+' : ''}${pubDelta} vs anterior`}
          deltaPositive={pubDelta === 0 ? null : pubDelta > 0}
          tone="success"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Em Revisão / Aprovados"
          value={`${social.awaitingApprovalCount} / ${social.approvedNotPublishedCount}`}
          subtitle="Aguardando revisão / Prontos p/ publicar"
          tone="accent"
          compact={preferences.compactTables}
        />
        <AnalyticsKpiCard
          label="Planejados Atrasados"
          value={String(social.overduePlannedCount)}
          subtitle="Data planejada vencida sem confirmação"
          tone={social.overduePlannedCount > 0 ? 'danger' : 'success'}
          compact={preferences.compactTables}
        />
      </div>

      {/* Evolução Editorial & Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="lg:col-span-2 space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Ritmo Editorial (Planejados vs Publicados)</CardTitle>
                <CardDescription>
                  Publicações contadas somente após confirmação manual de publicação.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onNavigateTab('social')}
            >
              Redes Sociais
            </Button>
          </CardHeader>

          <DualBarTimeSeriesChart
            points={social.timeSeries.map((pt) => ({
              key: pt.key,
              label: pt.label,
              valueA: pt.plannedCount,
              valueB: pt.publishedCount,
            }))}
            labelA="Planejados"
            labelB="Publicados"
            colorA="#C6A15B"
            colorB="#34D399"
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Pipeline Editorial (Base)</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={social.byStatus.map((s) => ({
              key: s.status,
              label: s.label,
              value: s.count,
              tone:
                s.status === 'publicado'
                  ? 'success'
                  : s.status === 'aprovado'
                  ? 'accent'
                  : 'neutral',
            }))}
            emptyMessage="Sem conteúdos cadastrados."
          />
        </Card>
      </div>

      {/* Plataforma, Formato e Entidade */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Por Plataforma</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={social.byPlatform.map((p) => ({
              key: p.platform,
              label: p.label,
              value: p.total,
              secondaryText: `${p.published} publ.`,
              tone: 'accent',
            }))}
            emptyMessage="Sem posts por plataforma."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Por Formato</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={social.byFormat.map((f) => ({
              key: f.format,
              label: f.label,
              value: f.total,
              secondaryText: `${f.published} publ.`,
              tone: 'neutral',
            }))}
            emptyMessage="Sem posts por formato."
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <CardHeader>
            <CardTitle>Kaizen vs Clientes (Período)</CardTitle>
          </CardHeader>
          <HorizontalBarBreakdown
            items={social.byOwnerEntity.map((e) => ({
              key: e.key,
              label: e.label,
              value: e.totalInPeriod,
              secondaryText: `${e.publishedInPeriod} publ. · ${e.overdueCount} atr.`,
              tone: e.ownerType === 'kaizen' ? 'accent' : 'success',
            }))}
            emptyMessage="Sem entregas sociais no período."
          />
        </Card>
      </div>

      {/* Posts Planejados Atrasados */}
      <Card padding="md" className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--kz-danger-text)]" />
            <CardTitle>Conteúdos com Data Vencida sem Publicação ({social.overduePosts.length})</CardTitle>
          </div>
        </CardHeader>

        {social.overduePosts.length === 0 ? (
          <EmptyState
            icon={<Share2 className="w-5 h-5" />}
            title="Calendário editorial em dia"
            description="Não existem conteúdos com data planejada vencida aguardando publicação."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Conta / Dono</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status Atual</TableHead>
                  <TableHead className="text-right">Data Planejada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {social.overduePosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell
                      className={`font-medium text-[var(--kz-text-primary)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {post.title}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {post.ownerLabel}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      {post.platformLabel}
                    </TableCell>
                    <TableCell className={preferences.compactTables ? 'py-2' : ''}>
                      <Badge variant="warning">{post.statusLabel}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-[var(--kz-danger-text)] ${
                        preferences.compactTables ? 'py-2' : ''
                      }`}
                    >
                      {formatDateBr(post.plannedDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  );
};
