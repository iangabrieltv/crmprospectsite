import { SystemLogEntry, SystemLogLevel, SystemLogSource } from '../../types/system';

const SENSITIVE_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDIGIDO]' },
  { regex: /AIza[0-9A-Za-z\-_]{12,}/g, replacement: '[CHAVE_GOOGLE_REDIGIDA]' },
  { regex: /sk-[A-Za-z0-9\-_]{10,}/g, replacement: '[CHAVE_SECRETA_REDIGIDA]' },
  {
    regex: /(api[_-]?key|secret|token|password|senha|private[_-]?key)\s*[:=]\s*[^\s,;'"`]+/gi,
    replacement: '$1=[REDIGIDO]',
  },
];

export function sanitizeSensitiveText(input: string, maxLength = 800): string {
  if (!input || typeof input !== 'string') return '';
  let cleaned = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned.trim().slice(0, maxLength);
}

export function generateSystemLogId(): string {
  return `syslog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function createSystemLogEntry(params: {
  level: SystemLogLevel;
  source: SystemLogSource;
  title: string;
  message: string;
  createdAt?: string;
}): SystemLogEntry {
  const now = params.createdAt || new Date().toISOString();
  return {
    id: generateSystemLogId(),
    level: params.level,
    source: params.source,
    title: sanitizeSensitiveText(params.title, 160) || 'Evento do sistema',
    message: sanitizeSensitiveText(params.message, 800) || 'Sem detalhes adicionais.',
    createdAt: now,
    schemaVersion: 1,
    updatedAt: now,
  };
}
