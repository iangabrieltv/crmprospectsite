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
 * Smart deduction of niche services to adapt cold messages naturally
 */
export function getDynamicNichoServices(nicho?: string, category?: string): string {
  const target = `${category || ''} ${nicho || ''}`.toLowerCase();
  if (target.includes('estétic') || target.includes('automot') || target.includes('polimento') || target.includes('lava') || target.includes('carro')) {
    return 'serviços de estética automotiva e polimento';
  }
  if (target.includes('dent') || target.includes('odonto') || target.includes('sorriso')) {
    return 'tratamentos e procedimentos odontológicos';
  }
  if (target.includes('nutri') || target.includes('aliment')) {
    return 'consultas e planos nutricionais';
  }
  if (target.includes('médic') || target.includes('clínic') || target.includes('saúde') || target.includes('consultório')) {
    return 'consultas e procedimentos da clínica';
  }
  if (target.includes('advoc') || target.includes('juríd') || target.includes('direito')) {
    return 'atendimentos e consultorias jurídicas';
  }
  if (target.includes('imob') || target.includes('corret') || target.includes('imóve')) {
    return 'vendas e locações de imóveis';
  }
  if (target.includes('academia') || target.includes('crossfit') || target.includes('fitness')) {
    return 'matrículas e planos de treino';
  }
  if (target.includes('pet') || target.includes('veterin')) {
    return 'atendimentos e procedimentos veterinários';
  }
  if (target.includes('beleza') || target.includes('salão') || target.includes('barbear') || target.includes('estética facial')) {
    return 'agendamentos e serviços de estética';
  }
  if (target.includes('restaurante') || target.includes('pizzaria') || target.includes('hambúrg')) {
    return 'pedidos e reservas de mesas';
  }
  if (target.includes('solar') || target.includes('energia')) {
    return 'projetos e instalações de energia solar';
  }
  if (target.includes('constru') || target.includes('reforma') || target.includes('arquit')) {
    return 'projetos e orçamentos de obras';
  }
  if (nicho && nicho.trim()) {
    const clean = nicho.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().toLowerCase();
    return `serviços e clientes de ${clean}`;
  }
  return 'novos clientes e agendamentos';
}

/**
 * Smart dynamic preview mockup URL for different industries
 */
export function getDynamicMockupUrl(nicho?: string, category?: string): string {
  const target = `${category || ''} ${nicho || ''}`.toLowerCase();
  if (target.includes('estétic') || target.includes('automot')) {
    return 'https://previa-estetica.framer.website';
  }
  if (target.includes('dent') || target.includes('odonto')) {
    return 'https://previa-odonto.framer.website';
  }
  if (target.includes('nutri')) {
    return 'https://previa-nutri.framer.website';
  }
  if (target.includes('médic') || target.includes('clínic')) {
    return 'https://previa-clinica.framer.website';
  }
  if (target.includes('advoc') || target.includes('juríd')) {
    return 'https://previa-advocacia.framer.website';
  }
  return 'https://previa-digital.framer.website';
}

/**
 * Clean niche label for lowercase sentences
 */
export function getCleanNichoLabel(nicho?: string): string {
  if (!nicho) return 'negócios locais';
  const clean = nicho.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  return clean.toLowerCase();
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
    categoria?: string;
    servicos?: string;
  }
): string {
  let result = template;
  const empresaVal = variables.empresa || 'sua empresa';
  const contatoVal = variables.contato || 'Camila';
  const seuNomeVal = variables.seuNome || 'Ian';
  const posicaoVal = variables.posicaoGoogle || '6ª';
  const h1Val = variables.horario1 || 'quinta às 14h';
  const h2Val = variables.horario2 || 'sexta às 10h';
  const cleanNicho = getCleanNichoLabel(variables.nicho);
  const servicosVal = variables.servicos || getDynamicNichoServices(variables.nicho, variables.categoria);
  const mockupVal = variables.linkMockup || getDynamicMockupUrl(variables.nicho, variables.categoria);

  // Smart extract of clean name without double title (e.g., if user saved "Dra. Camila", clean is "Camila")
  const prefixMatch = contatoVal.match(/^(?:Dra?\.|Doutor(?:a)?)\s*(.*)$/i);
  const cleanNameOnly = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : contatoVal;

  // Title-aware replacement for "Dra. [NOME]" or "Dr. [NOME]"
  result = result.replace(/Dra\.\s*\[NOME\]/gi, `Dra. ${cleanNameOnly}`);
  result = result.replace(/Dr\.\s*\[NOME\]/gi, `Dr. ${cleanNameOnly}`);
  result = result.replace(/Dra\.\s*\{Nome\}/gi, `Dra. ${cleanNameOnly}`);
  result = result.replace(/Dr\.\s*\{Nome\}/gi, `Dr. ${cleanNameOnly}`);

  // Dynamic services & industry terms
  result = result.replace(/\{ServicosNicho\}/gi, servicosVal);
  result = result.replace(/\{Servicos\}/gi, servicosVal);
  result = result.replace(/\[SERVICOSNICHO\]/gi, servicosVal);
  result = result.replace(/\[SERVICOS\]/gi, servicosVal);

  // Curly braces support {Var}
  result = result.replace(/\{Empresa\}/gi, empresaVal);
  result = result.replace(/\{NomeContato\}/gi, cleanNameOnly);
  result = result.replace(/\{Nome\}/gi, cleanNameOnly);
  result = result.replace(/\{Nicho\}/gi, cleanNicho);
  result = result.replace(/\{Cidade\}/gi, variables.cidade || 'sua região');
  result = result.replace(/\{LinkMockup\}/gi, mockupVal);
  result = result.replace(
    /\{NotaGoogle\}/gi,
    variables.notaGoogle ? `${variables.notaGoogle} ⭐` : 'excelentes avaliações'
  );
  result = result.replace(/\{SeuNome\}/gi, seuNomeVal);

  // Square bracket support for Cold Call & Nutri variables [NOME], [cidade], [NOME DA CLÍNICA], etc.
  result = result.replace(/\[NOME DA CLÍNICA\]/gi, empresaVal);
  result = result.replace(/\[NOME DA EMPRESA\]/gi, empresaVal);
  result = result.replace(/\[EMPRESA\]/gi, empresaVal);
  result = result.replace(/\[NICHO\]/gi, cleanNicho);
  result = result.replace(/\[NOME\]/gi, cleanNameOnly);
  result = result.replace(/\[CIDADE\]/gi, variables.cidade || 'sua cidade');
  result = result.replace(/\[LINKMOCKUP\]/gi, mockupVal);
  result = result.replace(/\[Xª\]/gi, posicaoVal);
  result = result.replace(/\[HORÁRIO 1\]/gi, h1Val);
  result = result.replace(/\[HORÁRIO 2\]/gi, h2Val);
  result = result.replace(/\[SEUNOME\]/gi, seuNomeVal);

  // Safety check to remove any duplicate honorifics e.g. "Dra. Dra."
  result = result.replace(/Dra\.\s*Dra\./gi, 'Dra.');
  result = result.replace(/Dr\.\s*Dr\./gi, 'Dr.');

  return result;
}

/**
 * Format relative friendly time for last contact (e.g. "Há 10 min", "Hoje às 14:20", "Ontem", "28/09")
 */
export function formatFriendlyTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMinutes = Math.floor((now - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return 'Agora mesmo';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
