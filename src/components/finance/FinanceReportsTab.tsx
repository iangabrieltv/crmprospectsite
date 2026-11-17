import React, { useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
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
  FinancialReportId,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { Client, Project } from '../../types/kaizen';
import {
  FINANCIAL_REPORT_DEFINITIONS,
  KAIZEN_TIMEZONE,
  buildGeneratedReportCsv,
  generateFinancialReport,
  getTodayInTimezone,
  triggerCsvDownload,
} from '../../services/finance';
import { downloadFinancialReportPdf } from '../../services/pdfService';

interface FinanceReportsTabProps {
  entries: FinancialEntry[];
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  recurrences: FinancialRecurrence[];
  settings: FinancialSettings;
  clients: Client[];
  projects: Project[];
  startDate: string;
  endDate: string;
  periodLabel: string;
  onNotify: (message: string) => void;
}

export const FinanceReportsTab: React.FC<FinanceReportsTabProps> = ({
  entries,
  transactions,
  categories,
  recurrences,
  settings,
  clients,
  projects,
  startDate,
  endDate,
  periodLabel,
  onNotify,
}) => {
  const [selectedReportId, setSelectedReportId] =
    useState<FinancialReportId>('receitas_periodo');
  const [clientIdFilter, setClientIdFilter] = useState('');
  const [categoryIdFilter, setCategoryIdFilter] = useState('');
  const todayStr = getTodayInTimezone(settings.timezone || KAIZEN_TIMEZONE);

  const report = useMemo(
    () =>
      generateFinancialReport({
        reportId: selectedReportId,
        entries,
        transactions,
        categories,
        recurrences,
        settings,
        clients,
        projects,
        startDate,
        endDate,
        periodLabel,
        clientIdFilter: clientIdFilter || undefined,
        categoryIdFilter: categoryIdFilter || undefined,
        todayStr,
      }),
    [
      selectedReportId,
      entries,
      transactions,
      categories,
      recurrences,
      settings,
      clients,
      projects,
      startDate,
      endDate,
      periodLabel,
      clientIdFilter,
      categoryIdFilter,
      todayStr,
    ]
  );

  const handleExportCsv = () => {
    const csv = buildGeneratedReportCsv(report);
    const filename = `kaizen-relatorio-${report.id}-${todayStr}.csv`;
    triggerCsvDownload(filename, csv);
    onNotify(`Relatório exportado em CSV: ${filename}`);
  };

  const handleExportPdf = () => {
    const filename = downloadFinancialReportPdf(
      report,
      settings.companyName || 'Agência Kaizen'
    );
    onNotify(`Relatório A4 gerado em PDF: ${filename}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Barra de seleção e filtros do relatório (oculta na impressão) */}
      <Card padding="md" className="space-y-3 kz-no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select
            label="Relatório Gerencial (15 modelos)"
            value={selectedReportId}
            onChange={(e) =>
              setSelectedReportId(e.target.value as FinancialReportId)
            }
          >
            {FINANCIAL_REPORT_DEFINITIONS.map((def) => (
              <option key={def.id} value={def.id}>
                {def.title}
              </option>
            ))}
          </Select>

          <Select
            label="Filtrar por Cliente (opcional)"
            value={clientIdFilter}
            onChange={(e) => setClientIdFilter(e.target.value)}
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>

          <Select
            label="Filtrar por Categoria (opcional)"
            value={categoryIdFilter}
            onChange={(e) => setCategoryIdFilter(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind === 'receita' ? 'Receita' : 'Despesa'})
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-[var(--kz-text-muted)]">
            Os arquivos exportados respeitam o período e os filtros ativos acima.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportCsv}
            >
              Exportar CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5" />}
              onClick={handleExportPdf}
            >
              Gerar PDF (A4)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrint}
            >
              Imprimir
            </Button>
          </div>
        </div>
      </Card>

      {/* Área imprimível do relatório */}
      <div className="kz-print-area space-y-4">
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--kz-accent-text)]">
                {settings.companyName || 'Agência Kaizen'} · Relatório Financeiro
              </div>
              <CardTitle className="mt-1 text-base">{report.title}</CardTitle>
              <CardDescription>
                {report.subtitle} · Período: {report.periodLabel}
              </CardDescription>
            </div>
            <div className="text-right text-[11px] text-[var(--kz-text-muted)] font-mono">
              Emitido em {new Date(report.generatedAtIso).toLocaleString('pt-BR')}
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.summaryCards.map((sc) => (
              <div
                key={sc.label}
                className="bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] rounded-xl p-3"
              >
                <span className="text-[11px] text-[var(--kz-text-muted)] block">
                  {sc.label}
                </span>
                <span className="text-base kz-metric text-[var(--kz-text-primary)] mt-1 block">
                  {sc.value}
                </span>
              </div>
            ))}
          </div>

          {report.rows.length === 0 ? (
            <EmptyState
              title="Sem registros neste relatório"
              description={report.emptyMessage}
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {report.columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {report.rows.map((row, idx) => (
                    <TableRow key={idx}>
                      {row.map((cell, cIdx) => (
                        <TableCell key={cIdx}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {report.totalsRow && (
                    <TableRow className="bg-[var(--kz-accent-soft)]/30 font-bold">
                      {report.totalsRow.map((cell, cIdx) => (
                        <TableCell
                          key={cIdx}
                          className="text-[var(--kz-text-primary)] font-mono"
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </div>
    </div>
  );
};
