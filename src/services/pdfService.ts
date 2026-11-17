import { jsPDF } from 'jspdf';
import { ProposalContract, getProposalStatusMeta } from '../types/kaizen';
import { GeneratedFinancialReport } from './finance/reportsService';

function formatCurrencyBrl(value: number): string {
  return `R$ ${(Number(value) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateBr(isoOrYmd?: string): string {
  if (!isoOrYmd) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    return isoOrYmd.split('-').reverse().join('/');
  }
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd;
  return d.toLocaleDateString('pt-BR');
}

function sanitizeFileSlug(text: string): string {
  return (text || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
}

/**
 * Generates an executive A4 PDF document for any Proposal or Contract using jsPDF.
 * Operates completely client-side via Blob download without popups or window.open.
 */
export function buildProposalPdfDocument(proposal: ProposalContract): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Top executive dark charcoal band with Kaizen gold stripe
  doc.setFillColor(16, 16, 20);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(198, 161, 91);
  doc.rect(0, 34, pageWidth, 1.2, 'F');

  doc.setTextColor(198, 161, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    proposal.kind === 'contrato'
      ? 'KAIZEN — CONTRATO DE PRESTAÇÃO DE SERVIÇOS'
      : 'KAIZEN — PROPOSTA COMERCIAL',
    margin,
    13
  );

  doc.setTextColor(245, 245, 247);
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(proposal.title || 'Documento Comercial', 122);
  doc.text(titleLines[0], margin, 22);

  doc.setTextColor(180, 180, 190);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Código: ${proposal.code}  ·  Emissão: ${formatDateBr(proposal.createdAt)}  ·  Status: ${
      getProposalStatusMeta(proposal.status).label
    }`,
    margin,
    29
  );

  // Right metadata badge in header
  doc.setTextColor(198, 161, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(proposal.code, pageWidth - margin, 18, { align: 'right' });
  if (proposal.validUntil) {
    doc.setTextColor(180, 180, 190);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Validade: ${formatDateBr(proposal.validUntil)}`, pageWidth - margin, 24, {
      align: 'right',
    });
  }

  y = 44;

  // Two-column Parties Box: Contratante & Contratada
  doc.setFillColor(247, 247, 249);
  doc.setDrawColor(225, 225, 230);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');

  const colMid = margin + contentWidth / 2 + 4;
  doc.setTextColor(115, 115, 128);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CONTRATANTE / CLIENTE', margin + 5, y + 6);
  doc.text('CONTRATADA / EMISSOR', colMid, y + 6);

  doc.setTextColor(22, 22, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text((proposal.recipientCompany || 'Cliente').slice(0, 42), margin + 5, y + 12);
  doc.text((proposal.issuerName || 'Agência Kaizen').slice(0, 42), colMid, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 75, 86);
  const leftDetails = [
    proposal.recipientContact ? `Resp.: ${proposal.recipientContact}` : null,
    proposal.recipientDocument ? `Doc.: ${proposal.recipientDocument}` : null,
    [proposal.recipientPhone, proposal.recipientCity].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');
  const rightDetails = [
    proposal.issuerDocument ? `Doc.: ${proposal.issuerDocument}` : 'Kaizen — Gestão & Tecnologia',
    proposal.recipientEmail ? `Contato cliente: ${proposal.recipientEmail}` : null,
    proposal.deliveryDeadlineDays
      ? `Prazo estimado: ${proposal.deliveryDeadlineDays} dias`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  doc.text(doc.splitTextToSize(leftDetails || '—', contentWidth / 2 - 8), margin + 5, y + 17.5);
  doc.text(doc.splitTextToSize(rightDetails || '—', contentWidth / 2 - 8), colMid, y + 17.5);

  y += 35;

  // Executive summary
  if (proposal.summary && proposal.summary.trim()) {
    ensureSpace(22);
    doc.setTextColor(22, 22, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('1. Visão Geral & Objetivo', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(65, 65, 75);
    const summaryLines = doc.splitTextToSize(proposal.summary.trim(), contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 4.5 + 6;
  }

  // Scope items table
  ensureSpace(26);
  doc.setTextColor(22, 22, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. Escopo e Itens Contratados', margin, y);
  y += 4;

  // Table header
  doc.setFillColor(24, 24, 30);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setTextColor(240, 240, 244);
  doc.setFontSize(8);
  doc.text('ITEM / DESCRIÇÃO', margin + 3, y + 5.2);
  doc.text('TIPO', margin + 106, y + 5.2);
  doc.text('QTD', margin + 128, y + 5.2, { align: 'right' });
  doc.text('VALOR', pageWidth - margin - 3, y + 5.2, { align: 'right' });
  y += 8;

  for (let i = 0; i < proposal.items.length; i++) {
    const item = proposal.items[i];
    const titleStr = item.title || `Item ${i + 1}`;
    const descLines = item.description
      ? doc.splitTextToSize(item.description, 96)
      : [];
    const rowHeight = Math.max(10, 7 + descLines.length * 3.8);

    ensureSpace(rowHeight + 2);
    if (i % 2 === 1) {
      doc.setFillColor(249, 249, 251);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(230, 230, 235);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    doc.setTextColor(22, 22, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(titleStr.slice(0, 56), margin + 3, y + 5);

    if (descLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(95, 95, 108);
      doc.text(descLines, margin + 3, y + 9);
    }

    const typeLabel =
      item.billingType === 'mensal'
        ? 'Mensal'
        : item.billingType === 'pontual'
        ? 'Pontual'
        : 'Setup';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(65, 65, 75);
    doc.text(typeLabel, margin + 106, y + 5);
    doc.text(String(item.quantity || 1), margin + 128, y + 5, { align: 'right' });

    const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 22, 28);
    doc.text(
      `${formatCurrencyBrl(subtotal)}${item.billingType === 'mensal' ? '/mês' : ''}`,
      pageWidth - margin - 3,
      y + 5,
      { align: 'right' }
    );

    y += rowHeight;
  }

  y += 6;

  // Financial Summary Box
  ensureSpace(34);
  doc.setFillColor(246, 243, 235);
  doc.setDrawColor(198, 161, 91);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  doc.setTextColor(125, 94, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESUMO DO INVESTIMENTO', margin + 5, y + 6);

  doc.setTextColor(22, 22, 28);
  doc.setFontSize(11);
  doc.text(
    `Implantação (Setup): ${formatCurrencyBrl(proposal.setupTotal)}`,
    margin + 5,
    y + 13.5
  );
  doc.text(
    `Recorrência Mensal: ${formatCurrencyBrl(proposal.monthlyMrr)}/mês`,
    margin + 5,
    y + 20.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 75, 85);
  const rightFinText = [
    proposal.discountValue && proposal.discountValue > 0
      ? `Desconto aplicado: ${formatCurrencyBrl(proposal.discountValue)}`
      : null,
    proposal.deliveryDeadlineDays
      ? `Prazo de entrega: ${proposal.deliveryDeadlineDays} dias`
      : null,
    proposal.paymentTerms ? `Condições: ${proposal.paymentTerms}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  doc.text(
    doc.splitTextToSize(rightFinText || 'Conforme condições acordadas.', 82),
    pageWidth - margin - 5,
    y + 11,
    { align: 'right' }
  );

  y += 33;

  // Contract Clauses / Terms
  if (proposal.clausesText && proposal.clausesText.trim()) {
    ensureSpace(20);
    doc.setTextColor(22, 22, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('3. Cláusulas e Condições Gerais', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(65, 65, 75);
    const clauseLines = doc.splitTextToSize(proposal.clausesText.trim(), contentWidth);
    for (const line of clauseLines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4;
    }
    y += 5;
  }

  // Signature block
  ensureSpace(32);
  y += 4;
  doc.setDrawColor(160, 160, 170);
  doc.line(margin, y + 14, margin + 74, y + 14);
  doc.line(pageWidth - margin - 74, y + 14, pageWidth - margin, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 22, 28);
  doc.text(proposal.issuerName || 'Agência Kaizen', margin + 37, y + 19, { align: 'center' });
  doc.text(
    proposal.recipientCompany || 'Contratante',
    pageWidth - margin - 37,
    y + 19,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 122);
  doc.text('CONTRATADA', margin + 37, y + 23.5, { align: 'center' });
  doc.text('CONTRATANTE', pageWidth - margin - 37, y + 23.5, { align: 'center' });

  // Page footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 152);
    doc.text(
      `Kaizen — Gestão Integrada · ${proposal.code}`,
      margin,
      pageHeight - 10
    );
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 10, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadProposalPdf(proposal: ProposalContract): string {
  const doc = buildProposalPdfDocument(proposal);
  const slug = sanitizeFileSlug(proposal.recipientCompany || proposal.title);
  const filename = `${proposal.code || 'kaizen-doc'}-${slug}.pdf`;
  doc.save(filename);
  return filename;
}

export function buildFinancialReportPdfDocument(
  report: GeneratedFinancialReport,
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

  // Kaizen header
  doc.setFillColor(16, 16, 20);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(198, 161, 91);
  doc.rect(0, 28, pageWidth, 1.1, 'F');

  doc.setTextColor(198, 161, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`${companyName.toUpperCase()} — RELATÓRIO FINANCEIRO GERENCIAL`, margin, 10);

  doc.setTextColor(245, 245, 247);
  doc.setFontSize(14);
  doc.text(report.title, margin, 18.5);

  doc.setTextColor(180, 180, 190);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const generatedLabel = new Date(report.generatedAtIso).toLocaleString('pt-BR');
  doc.text(`Período: ${report.periodLabel}`, margin, 24);
  doc.text(`Emitido em: ${generatedLabel}`, pageWidth - margin, 24, { align: 'right' });

  y = 35;

  // Summary KPIs row
  if (report.summaryCards.length > 0) {
    const gap = 3;
    const cardW =
      (contentWidth - gap * (report.summaryCards.length - 1)) /
      report.summaryCards.length;
    report.summaryCards.forEach((card, idx) => {
      const x = margin + idx * (cardW + gap);
      doc.setFillColor(246, 246, 249);
      doc.setDrawColor(225, 225, 232);
      doc.roundedRect(x, y, cardW, 14, 1.5, 1.5, 'FD');
      doc.setTextColor(110, 110, 122);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(card.label.toUpperCase().slice(0, 28), x + 3, y + 5);
      doc.setTextColor(22, 22, 28);
      doc.setFontSize(9.5);
      doc.text(card.value.slice(0, 24), x + 3, y + 11);
    });
    y += 19;
  }

  // Table Header & Rows
  const colCount = Math.max(1, report.columns.length);
  const colWidth = contentWidth / colCount;

  const drawTableHeader = () => {
    doc.setFillColor(24, 24, 30);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(240, 240, 244);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    report.columns.forEach((col, idx) => {
      const x = margin + idx * colWidth + 2;
      doc.text(col.slice(0, Math.floor(colWidth / 1.7)), x, y + 5);
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
      doc.setFontSize(7.2);
      doc.setTextColor(35, 35, 42);
      row.forEach((cell, cIdx) => {
        const x = margin + cIdx * colWidth + 2;
        const maxChars = Math.max(8, Math.floor(colWidth / 1.65));
        const text = (cell || '—').length > maxChars
          ? `${cell.slice(0, maxChars - 1)}…`
          : cell || '—';
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
    doc.setFontSize(7.4);
    doc.setTextColor(22, 22, 28);
    report.totalsRow.forEach((cell, cIdx) => {
      const x = margin + cIdx * colWidth + 2;
      const maxChars = Math.max(8, Math.floor(colWidth / 1.65));
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
      `${companyName} · ${report.title} · Valores gerenciais em BRL`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadFinancialReportPdf(
  report: GeneratedFinancialReport,
  companyName: string = 'Agência Kaizen'
): string {
  const doc = buildFinancialReportPdfDocument(report, companyName);
  const slug = sanitizeFileSlug(report.id);
  const stamp = report.generatedAtIso.slice(0, 10);
  const filename = `kaizen-financeiro-${slug}-${stamp}.pdf`;
  doc.save(filename);
  return filename;
}
