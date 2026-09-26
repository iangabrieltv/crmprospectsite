/**
 * Clean raw phone numbers to E.164 Brazilian WhatsApp format (55 + DDD + 8 or 9 digits)
 */
export function cleanPhoneForWhatsApp(raw: string, defaultDdd: string = '11'): string {
  if (!raw) return '';
  // Remove non-digit characters
  let digits = raw.replace(/\D/g, '');

  // If already starts with 55 and has 12 or 13 digits (e.g. 55 11 98888 7777)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // If has 10 or 11 digits (DDD + number)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // If has 8 or 9 digits (local number without DDD)
  if (digits.length === 8 || digits.length === 9) {
    const cleanDdd = defaultDdd.replace(/\D/g, '').slice(-2) || '11';
    return `55${cleanDdd}${digits}`;
  }

  // Otherwise return whatever digits we found
  return digits.length > 5 ? digits : '';
}

/**
 * Format phone for UI display (e.g. +55 (11) 98765-4321)
 */
export function formatDisplayPhone(phone: string): string {
  if (!phone) return 'Sem telefone';
  const clean = phone.replace(/\D/g, '');

  if (clean.length === 13 && clean.startsWith('55')) {
    // 55 11 99999 8888
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    // 55 11 8888 8888
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }

  return phone;
}

/**
 * Generate wa.me link with encoded message
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const clean = cleanPhoneForWhatsApp(phone);
  if (!clean) return '#';
  const encoded = encodeURIComponent(message.trim());
  return `https://wa.me/${clean}?text=${encoded}`;
}

/**
 * Check if a lead has been inactive for more than 48 hours
 */
export function isInactiveOver48h(lastContactDate?: string, createdAt?: string): boolean {
  const referenceDate = lastContactDate || createdAt;
  if (!referenceDate) return false;
  const refTime = new Date(referenceDate).getTime();
  if (isNaN(refTime)) return false;
  const now = Date.now();
  const diffHours = (now - refTime) / (1000 * 60 * 60);
  return diffHours >= 48;
}

/**
 * Interpolate script templates with dynamic lead variables
 */
export function interpolateScript(
  template: string,
  variables: {
    empresa?: string;
    contato?: string;
    nicho?: string;
    cidade?: string;
    linkMockup?: string;
    notaGoogle?: number | string;
    seuNome?: string;
    posicaoGoogle?: string;
    horario1?: string;
    horario2?: string;
  }
): string {
  let result = template;
  const empresaVal = variables.empresa || 'sua empresa';
  const contatoVal = variables.contato || 'Prezado(a)';
  const seuNomeVal = variables.seuNome || 'Ian';
  const posicaoVal = variables.posicaoGoogle || '6ª';
  const h1Val = variables.horario1 || 'quinta às 14h';
  const h2Val = variables.horario2 || 'sexta às 10h';

  // Curly braces support {Var}
  result = result.replace(/\{Empresa\}/gi, empresaVal);
  result = result.replace(/\{NomeContato\}/gi, contatoVal);
  result = result.replace(/\{Nicho\}/gi, variables.nicho || 'seu segmento');
  result = result.replace(/\{Cidade\}/gi, variables.cidade || 'sua região');
  result = result.replace(/\{LinkMockup\}/gi, variables.linkMockup || '[Link da Demonstração]');
  result = result.replace(
    /\{NotaGoogle\}/gi,
    variables.notaGoogle ? `${variables.notaGoogle} ⭐` : 'excelentes avaliações'
  );
  result = result.replace(/\{SeuNome\}/gi, seuNomeVal);

  // Square bracket support for Cold Call variables [NOME], [NOME DA CLÍNICA], [Xª], [HORÁRIO 1], etc.
  result = result.replace(/\[NOME DA CLÍNICA\]/gi, empresaVal);
  result = result.replace(/\[NOME\]/gi, contatoVal);
  result = result.replace(/\[Xª\]/gi, posicaoVal);
  result = result.replace(/\[HORÁRIO 1\]/gi, h1Val);
  result = result.replace(/\[HORÁRIO 2\]/gi, h2Val);
  result = result.replace(/\[SEUNOME\]/gi, seuNomeVal);

  return result;
}
