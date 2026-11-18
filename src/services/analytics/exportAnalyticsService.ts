import { jsPDF } from 'jspdf';
import { GeneratedAnalyticsReport } from '../../types/analytics';
import { buildCsvContent, triggerCsvDownload } from '../finance/money';

function sanitizeFileSlug(text: string): string {
  return (text || 'relatorio-kaizen')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
}

/**
 * Gera CSV UTF-8 BOM compatível com Excel PT-BR (separador `;`, proteção contra formula injection),
 * preservando exatamente as colunas, linhas e linha de totais exibidas na tela.
 */
export function buildAnalyticsCsvContent(report: GeneratedAnalyticsReport): string {
  const rows: (string | number)[][] = [...report.rows];
  if (report.totalsRow && report.rows.length > 0) {
    rows.push(report.totalsRow);
  }
  return buildCsvContent(report.columns, rows);
}

export function downloadAnalyticsReportCsv(report: GeneratedAnalyticsReport): string {
  const csv = buildAnalyticsCsvContent(report);
  const slug = sanitizeFileSlug(report.id || report.title);
  const stamp = report.generatedAtIso.slice(0, 10);
  const filename = `kaizen-relatorio-${slug}-${stamp}.csv`;
  triggerCsvDownload(filename, csv);
  return filename;
}

/**
 * Gera PDF executivo A4 padronizado com identidade Kaizen (sem popups nem window.open),
 * contendo título, período, filtros aplicados, cards de resumo e tabela fiel aos dados em tela.
 */
export function buildAnalyticsReportPdfDocument(
  report: GeneratedAnalyticsReport,
  companyName: string = 'Agência Kaizen'
): jsPDF {
  const useLandscape = report.columns.length >= 6;
  const doc = new jsPDF({
    orientation: useLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Cabeçalho Premium Kaizen
  doc.setFillColor(16, 16, 20);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(198, 161, 91);
  doc.rect(0, 30, pageWidth, 1.2, 'F');

  doc.setTextColor(198, 161, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text(
    `${companyName.toUpperCase()} — INTELIGÊNCIA E RELATÓRIOS GERENCIAIS`,
    margin,
    9.5
  );

  doc.setTextColor(245, 245, 247);
  doc.setFontSize(13.5);
  doc.text(report.title.slice(0, 74), margin, 17.5);

  doc.setTextColor(180, 180, 190);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const generatedLabel = new Date(report.generatedAtIso).toLocaleString('pt-BR');
  doc.text(`Período: ${report.periodLabel}`, margin, 23.5);
  doc.text(`Emitido em: ${generatedLabel}`, pageWidth - margin, 23.5, { align: 'right' });
  doc.text(
    `Filtros: ${report.appliedFiltersSummary.slice(0, 115)}`,
    margin,
    27.6
  );

  y = 36;

  // Summary Cards
  if (report.summaryCards.length > 0) {
    const visibleCards = report.summaryCards.slice(0, 5);
    const gap = 3;
    const cardW = (contentWidth - gap * (visibleCards.length - 1)) / visibleCards.length;
    visibleCards.forEach((card, idx) => {
      const x = margin + idx * (cardW + gap);
      doc.setFillColor(246, 246, 249);
      doc.setDrawColor(225, 225, 232);
      doc.roundedRect(x, y, cardW, 14.5, 1.5, 1.5, 'FD');
      doc.setTextColor(110, 110, 122);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.text(card.label.toUpperCase().slice(0, 28), x + 2.8, y + 5);
      doc.setTextColor(22, 22, 28);
      doc.setFontSize(9.2);
      doc.text(card.value.slice(0, 26), x + 2.8, y + 11);
    });
    y += 19.5;
  }

  // Limitation notice if applicable
  if (report.dataLimitationsNote) {
    const noteLines = doc.splitTextToSize(`Transparência: ${report.dataLimitationsNote}`, contentWidth - 6);
    const boxH = Math.max(9, noteLines.length * 3.8 + 4);
    doc.setFillColor(251, 248, 240);
    doc.setDrawColor(218, 190, 130);
    doc.roundedRect(margin, y, contentWidth, boxH, 1.2, 1.2, 'FD');
    doc.setTextColor(115, 86, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(noteLines, margin + 3, y + 4.8);
    y += boxH + 4;
  }

  // Table
  const colCount = Math.max(1, report.columns.length);
  const colWidth = contentWidth / colCount;

  const drawTableHeader = () => {
    doc.setFillColor(24, 24, 30);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(240, 240, 244);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    report.columns.forEach((col, idx) => {
      const x = margin + idx * colWidth + 2;
      doc.text(col.slice(0, Math.max(8, Math.floor(colWidth / 1.75))), x, y + 5);
    });
    y += 7.5;
  };

  drawTableHeader();

  if (report.rows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 112);
    doc.text(report.emptyMessage, margin + 3, y + 8);
    y += 14;
  } else {
    report.rows.forEach((row, rIdx) => {
      if (y + 7 > pageHeight - 18) {
        doc.addPage();
        y = 16;
        drawTableHeader();
      }
      if (rIdx % 2 === 1) {
        doc.setFillColor(249, 249, 251);
        doc.rect(margin, y, contentWidth, 6.5, 'F');
      }
      doc.setDrawColor(232, 232, 236);
      doc.line(margin, y + 6.5, pageWidth - margin, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(35, 35, 42);
      row.forEach((cell, cIdx) => {
        const x = margin + cIdx * colWidth + 2;
        const maxChars = Math.max(8, Math.floor(colWidth / 1.7));
        const val = cell || '—';
        const text = val.length > maxChars ? `${val.slice(0, maxChars - 1)}…` : val;
        doc.text(text, x, y + 4.4);
      });
      y += 6.5;
    });
  }

  if (report.totalsRow && report.rows.length > 0) {
    if (y + 8 > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
    doc.setFillColor(244, 240, 230);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(22, 22, 28);
    report.totalsRow.forEach((cell, cIdx) => {
      const x = margin + cIdx * colWidth + 2;
      const maxChars = Math.max(8, Math.floor(colWidth / 1.7));
      doc.text((cell || '—').slice(0, maxChars), x, y + 5);
    });
    y += 7.5;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(135, 135, 148);
    doc.text(
      `${companyName} · ${report.moduleLabel} · Dados reais do sistema`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadAnalyticsReportPdf(
  report: GeneratedAnalyticsReport,
  companyName: string = 'Agência Kaizen'
): string {
  const doc = buildAnalyticsReportPdfDocument(report, companyName);
  const slug = sanitizeFileSlug(report.id || report.title);
  const stamp = report.generatedAtIso.slice(0, 10);
  const filename = `kaizen-relatorio-${slug}-${stamp}.pdf`;
  doc.save(filename);
  return filename;
}
