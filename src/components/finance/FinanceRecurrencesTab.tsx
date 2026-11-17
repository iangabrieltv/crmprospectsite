import React, { useState } from 'react';
import { Edit3, PauseCircle, PlayCircle, Plus, RefreshCw, StopCircle } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
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
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialRecurrenceStatus,
  getRecurrenceFrequencyLabel,
} from '../../types/finance';
import { Client } from '../../types/kaizen';
import {
  formatBrlFromCents,
  formatDateBr,
  getCategoryName,
} from '../../services/finance';

interface FinanceRecurrencesTabProps {
  recurrences: FinancialRecurrence[];
  entries: FinancialEntry[];
  categories: FinancialCategory[];
  clients: Client[];
  onNewRecurrence: () => void;
  onEditRecurrence: (rec: FinancialRecurrence) => void;
  onChangeStatus: (
    rec: FinancialRecurrence,
    status: FinancialRecurrenceStatus
  ) => Promise<void>;
  onProcessDueOccurrences: () => Promise<void>;
}

export const FinanceRecurrencesTab: React.FC<FinanceRecurrencesTabProps> = ({
  recurrences,
  entries,
  categories,
  clients,
  onNewRecurrence,
  onEditRecurrence,
  onChangeStatus,
  onProcessDueOccurrences,
}) => {
  const [processing, setProcessing] = useState(false);

  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

  const activeReceitaMrr = recurrences
    .filter((r) => r.kind === 'receita' && r.status === 'ativa')
    .reduce((s, r) => s + r.amountCents, 0);
  const activeDespesaMrr = recurrences
    .filter((r) => r.kind === 'despesa' && r.status === 'ativa')
    .reduce((s, r) => s + r.amountCents, 0);

  const handleGenerate = async () => {
    setProcessing(true);
    try {
      await onProcessDueOccurrences();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <span className="text-xs">
          <strong>Geração idempotente controlada no cliente:</strong> ao abrir o Financeiro ou
          clicar em <em>Processar Ocorrências Devidas</em>, o sistema gera apenas parcelas até a
          data atual em status <strong>Pendente</strong> (nunca confirma recebimento/pagamento
          automaticamente e nunca duplica a mesma competência). Não há cron server-side em
          segundo plano nesta versão.
        </span>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card padding="md">
          <span className="text-[11px] text-[var(--kz-text-muted)] block">
            Recorrências Ativas (Receitas)
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-success-text)]">
            {formatBrlFromCents(activeReceitaMrr)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            {recurrences.filter((r) => r.kind === 'receita' && r.status === 'ativa').length}{' '}
            ativa(s)
          </div>
        </Card>

        <Card padding="md">
          <span className="text-[11px] text-[var(--kz-text-muted)] block">
            Recorrências Ativas (Despesas)
          </span>
          <div className="mt-1.5 text-xl kz-metric text-[var(--kz-danger-text)]">
            {formatBrlFromCents(activeDespesaMrr)}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5">
            {recurrences.filter((r) => r.kind === 'despesa' && r.status === 'ativa').length}{' '}
            ativa(s)
          </div>
        </Card>

        <Card padding="md" className="flex flex-col justify-between gap-2">
          <span className="text-[11px] text-[var(--kz-text-muted)]">
            Ações das Recorrências
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={onNewRecurrence}
            >
              Nova Recorrência
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={processing}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleGenerate}
            >
              Processar Ocorrências Devidas
            </Button>
          </div>
        </Card>
      </div>

      {recurrences.length === 0 ? (
        <EmptyState
          title="Nenhuma recorrência configurada"
          description="Cadastre mensalidades de clientes ou custos fixos recorrentes (hospedagem, ferramentas, APIs)."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={onNewRecurrence}
            >
              Criar Primeira Recorrência
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Recorrência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente / Fornecedor</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Próxima</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Gerados</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurrences.map((rec) => {
                const generatedCount = entries.filter(
                  (e) => e.recurrenceId === rec.id
                ).length;
                const statusBadge =
                  rec.status === 'ativa'
                    ? { variant: 'success' as const, label: 'Ativa' }
                    : rec.status === 'pausada'
                    ? { variant: 'warning' as const, label: 'Pausada' }
                    : { variant: 'neutral' as const, label: 'Encerrada' };

                return (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-[var(--kz-text-primary)]">
                        {rec.name}
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)]">
                        {getCategoryName(categories, rec.categoryId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rec.kind === 'receita' ? 'success' : 'danger'}>
                        {rec.kind === 'receita' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {rec.kind === 'receita'
                        ? (rec.clientId ? clientMap.get(rec.clientId) : '') || 'Kaizen'
                        : rec.supplierName || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {getRecurrenceFrequencyLabel(rec.frequency, rec.customIntervalDays)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {rec.status === 'encerrada' ? '—' : formatDateBr(rec.nextOccurrenceDate)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-xs font-bold">
                      {formatBrlFromCents(rec.amountCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-[var(--kz-text-muted)]">
                      {generatedCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {rec.status !== 'encerrada' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onEditRecurrence(rec)}
                            title="Editar para futuras ocorrências"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {rec.status === 'ativa' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onChangeStatus(rec, 'pausada')}
                            title="Pausar geração"
                          >
                            <PauseCircle className="w-3.5 h-3.5 text-[var(--kz-warning-text)]" />
                          </Button>
                        )}
                        {rec.status === 'pausada' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onChangeStatus(rec, 'ativa')}
                            title="Reativar"
                          >
                            <PlayCircle className="w-3.5 h-3.5 text-[var(--kz-success-text)]" />
                          </Button>
                        )}
                        {rec.status !== 'encerrada' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onChangeStatus(rec, 'encerrada')}
                            title="Encerrar recorrência"
                          >
                            <StopCircle className="w-3.5 h-3.5 text-[var(--kz-danger-text)]" />
                          </Button>
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
    </div>
  );
};
