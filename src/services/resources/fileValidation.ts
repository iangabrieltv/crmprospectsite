import {
  ALLOWED_FILE_EXTENSIONS,
  AllowedFileExtension,
  DANGEROUS_FILE_EXTENSIONS,
  MAX_UPLOAD_FILE_BYTES,
} from '../../types/resources';

export type FilePreviewMode =
  | 'image'
  | 'pdf'
  | 'video'
  | 'text'
  | 'spreadsheet'
  | 'unsupported';

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  extension?: AllowedFileExtension;
  sanitizedOriginalName?: string;
  mimeType?: string;
}

const MIME_BY_EXTENSION: Record<AllowedFileExtension, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
};

const DANGEROUS_MIME_FRAGMENTS = [
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-sh',
  'application/x-bash',
  'application/javascript',
  'text/javascript',
  'application/x-httpd-php',
  'text/html',
];

export function extractFileExtension(fileName: string): string {
  const clean = (fileName || '').trim().split(/[\\/]/).pop() || '';
  const lastDot = clean.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

export function sanitizeFileName(fileName: string): string {
  const base = (fileName || 'arquivo').trim().split(/[\\/]/).pop() || 'arquivo';
  const cleaned = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '');
  return (cleaned || 'arquivo').slice(0, 160);
}

export function isDangerousExtension(ext: string): boolean {
  const normalized = (ext || '').trim().toLowerCase().replace(/^\./, '');
  return (DANGEROUS_FILE_EXTENSIONS as readonly string[]).includes(normalized);
}

export function isAllowedExtension(ext: string): ext is AllowedFileExtension {
  const normalized = (ext || '').trim().toLowerCase().replace(/^\./, '');
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(normalized);
}

export function validateUploadFile(params: {
  name: string;
  size: number;
  type?: string;
}): FileValidationResult {
  const rawName = (params.name || '').trim();
  if (!rawName) {
    return { ok: false, error: 'Nome do arquivo inválido ou vazio.' };
  }

  const ext = extractFileExtension(rawName);
  if (!ext) {
    return {
      ok: false,
      error:
        'Arquivo sem extensão reconhecida. Envie apenas formatos permitidos (PDF, DOCX, XLSX, PPTX, PNG, JPG, SVG, MP4, TXT, CSV ou ZIP).',
    };
  }

  if (isDangerousExtension(ext)) {
    return {
      ok: false,
      error: `Formato ".${ext}" bloqueado por política de segurança. Arquivos executáveis ou scripts não são permitidos.`,
    };
  }

  // Verifica dupla extensão suspeita (ex.: proposta.pdf.exe ou anexo.bat.txt)
  const parts = rawName.toLowerCase().split('.');
  if (parts.length > 2) {
    const intermediateParts = parts.slice(1, -1);
    const dangerousNested = intermediateParts.find((p) => isDangerousExtension(p));
    if (dangerousNested) {
      return {
        ok: false,
        error: `Nome de arquivo suspeito contendo ".${dangerousNested}". Por segurança, o envio foi bloqueado.`,
      };
    }
  }

  if (!isAllowedExtension(ext)) {
    return {
      ok: false,
      error: `Formato ".${ext}" não suportado. Formatos aceitos: ${ALLOWED_FILE_EXTENSIONS.map((f) => `.${f}`).join(', ')}.`,
    };
  }

  const lowerMime = (params.type || '').toLowerCase();
  if (lowerMime && DANGEROUS_MIME_FRAGMENTS.some((frag) => lowerMime.includes(frag))) {
    return {
      ok: false,
      error: `Tipo MIME "${params.type}" bloqueado pela política de segurança.`,
    };
  }

  if (!Number.isFinite(params.size) || params.size <= 0) {
    return {
      ok: false,
      error: 'O arquivo selecionado está vazio (0 bytes) e não pode ser cadastrado.',
    };
  }

  if (params.size > MAX_UPLOAD_FILE_BYTES) {
    return {
      ok: false,
      error: `Arquivo excede o limite de ${(MAX_UPLOAD_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB (${formatFileSize(params.size)}).`,
    };
  }

  const sanitizedOriginalName = sanitizeFileName(rawName);
  const mimeType = params.type?.trim() || MIME_BY_EXTENSION[ext];

  return {
    ok: true,
    extension: ext,
    sanitizedOriginalName,
    mimeType,
  };
}

export function getPreviewModeForExtension(ext: string): FilePreviewMode {
  const normalized = (ext || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'svg'].includes(normalized)) return 'image';
  if (normalized === 'pdf') return 'pdf';
  if (normalized === 'mp4') return 'video';
  if (normalized === 'txt' || normalized === 'csv') return 'text';
  if (normalized === 'xls' || normalized === 'xlsx') return 'spreadsheet';
  return 'unsupported';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
