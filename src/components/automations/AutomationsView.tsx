import React, { useMemo, useState } from 'react';
import {
  Zap,
  Play,
  PlayCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  History,
} from 'lucide-react';
import {
  AutomationCategory,
  AutomationExecutionLog,
  AutomationRuleSetting,
} from '../../types/system';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Tabs,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui';

interface AutomationsViewProps {
  rules: AutomationRuleSetting[];
  logs: AutomationExecutionLog[];
  onToggleRule: (ruleId: string, enabled: boolean) => Promise<void> | void;
  onRunRule: (ruleId: string) => Promise<void> | void;
  onRunAllActive: () => Promise<void> | void;
}

type CategoryTab = 'all' | AutomationCategory;

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules,
  logs,
  onToggleRule,
  onRunRule,
  onRunAllActive,
}) => {
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredRules = useMemo(
    () =>
      categoryTab === 'all'
        ? rules
        : rules.filter((r) => r.category === categoryTab),
    [rules, categoryTab]
  );

  const activeCount = useMemo(
    () => rules.filter((r) => r.enabled).length,
    [rules]
  );

  const totalFindingsLastRun = useMemo(
    () =>
      rules
        .filter((r) => r.enabled)
        .reduce((acc, r) => acc + (r.lastFindingsCount || 0), 0),
    [rules]
  );

  const handleRunAll = async () => {
    setIsRunningAll(true);
    setFeedback(null);
    try {
      await onRunAllActive();
      setFeedback('Todas as regras ativas foram avaliadas com segurança.');
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsRunningAll(false);
    }
  };

  const handleRunSingle = async (rule: AutomationRuleSetting) => {
    setRunningRuleId(rule.id);
    setFeedback(null);
    try {
      await onRunRule(rule.id);
      setFeedback(`Regra "${rule.name}" executada.`);
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setRunningRuleId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">Automações & Monitoramento Seguro</h2>
          <p className="kz-subtitle">
            Regras determinísticas de acompanhamento comercial, operacional e financeiro executadas sob demanda ou na abertura do sistema.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          loading={isRunningAll}
          leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
          onClick={handleRunAll}
        >
          Executar Todas Ativas ({activeCount})
        </Button>
      </div>

      <Alert variant="info" title="Política de Execução Transparente e Sem Efeitos Colaterais">
        As regras abaixo rodam <strong>manualmente ou ao abrir o sistema</strong> (não há agendador/cron em segundo plano neste ambiente). Elas <strong>nunca</strong> alteram lançamentos financeiros, não dão baixa em contas, não excluem dados e não disparam mensagens externas automaticamente.
      </Alert>

      {feedback && (
        <Alert variant="success" onDismiss={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Regras Ativas</span>
            <Zap className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {activeCount} / {rules.length}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Comercial, Operacional e Financeiro
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Pendências Detectadas</span>
            <ShieldAlert className="w-3.5 h-3.5 text-[var(--kz-warning-solid)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-warning-text)]">
            {totalFindingsLastRun}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Soma dos achados na última execução
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
            <span>Execuções Registradas</span>
            <History className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {logs.length}
          </div>
          <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Auditoria persistida no Firestore
          </div>
        </Card>
      </div>

      {/* Category Tabs */}
      <Tabs<CategoryTab>
        activeId={categoryTab}
        onChange={setCategoryTab}
        items={[
          { id: 'all', label: 'Todas', badge: rules.length },
          {
            id: 'comercial',
            label: 'Comercial',
            badge: rules.filter((r) => r.category === 'comercial').length,
          },
          {
            id: 'operacional',
            label: 'Operacional',
            badge: rules.filter((r) => r.category === 'operacional').length,
          },
          {
            id: 'financeiro',
            label: 'Financeiro',
            badge: rules.filter((r) => r.category === 'financeiro').length,
          },
        ]}
      />

      {/* Rule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredRules.map((rule) => (
          <Card key={rule.id} padding="md" className="space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        rule.category === 'comercial'
                          ? 'accent'
                          : rule.category === 'financeiro'
                          ? 'warning'
                          : 'info'
                      }
                      size="sm"
                    >
                      {rule.category}
                    </Badge>
                    <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                      {rule.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--kz-text-secondary)] leading-relaxed">
                    {rule.description}
                  </p>
                </div>

                {/* Accessible Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`Alternar regra ${rule.name}`}
                  onClick={() => onToggleRule(rule.id, !rule.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    rule.enabled
                      ? 'bg-[var(--kz-accent)]'
                      : 'bg-[var(--kz-bg-muted)] border-[var(--kz-border-default)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--kz-bg-canvas)] shadow-sm transition duration-150 ${
                      rule.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="text-[11px] text-[var(--kz-text-muted)] space-y-0.5 bg-[var(--kz-bg-subtle)]/50 p-2.5 rounded-lg border border-[var(--kz-border-subtle)]">
                <div>
                  <strong>Critério:</strong> {rule.triggerCondition}
                </div>
                <div>
                  <strong>Garantia:</strong> {rule.nextCheckNote}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--kz-border-subtle)]">
              <div className="flex items-center gap-2 text-[11px] text-[var(--kz-text-muted)]">
                {rule.lastRunAt ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Última: {new Date(rule.lastRunAt).toLocaleString('pt-BR')}
                    </span>
                    <Badge
                      variant={
                        rule.lastStatus === 'erro'
                          ? 'danger'
                          : (rule.lastFindingsCount || 0) > 0
                          ? 'warning'
                          : 'success'
                      }
                      size="sm"
                    >
                      {rule.lastFindingsCount ?? 0} achado(s)
                    </Badge>
                  </>
                ) : (
                  <span>Ainda não executada</span>
                )}
              </div>

              <Button
                variant="outline"
                size="xs"
                loading={runningRuleId === rule.id}
                leftIcon={<Play className="w-3 h-3" />}
                onClick={() => handleRunSingle(rule)}
              >
                Executar Agora
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Execution History */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div>
            <CardTitle>Histórico Recente de Execuções</CardTitle>
            <CardDescription>
              Resultados registrados em cada rodada manual ou na abertura da sessão.
            </CardDescription>
          </div>
        </CardHeader>

        {logs.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-5 h-5" />}
            title="Nenhuma execução registrada ainda"
            description="Clique em 'Executar Todas Ativas' ou execute qualquer regra individualmente para visualizar os resultados aqui."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Achados</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 35).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-[11px] text-[var(--kz-text-muted)] whitespace-nowrap">
                      {new Date(log.executedAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-[var(--kz-text-primary)]">
                        {log.ruleName}
                      </div>
                      <div className="text-[10px] text-[var(--kz-text-muted)] capitalize">
                        {log.category}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[var(--kz-text-secondary)]">
                      {log.triggerType === 'abertura_sistema' ? 'Abertura' : 'Manual'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === 'erro'
                            ? 'danger'
                            : log.status === 'sucesso'
                            ? 'warning'
                            : 'success'
                        }
                        size="sm"
                      >
                        {log.status === 'sucesso'
                          ? 'Com alertas'
                          : log.status === 'sem_alertas'
                          ? 'Sem pendências'
                          : 'Erro'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs">
                      {log.findingsCount}
                    </TableCell>
                    <TableCell className="text-xs text-[var(--kz-text-secondary)] max-w-md">
                      <div>{log.summary}</div>
                      {log.details && (
                        <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5 truncate">
                          {log.details}
                        </div>
                      )}
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
