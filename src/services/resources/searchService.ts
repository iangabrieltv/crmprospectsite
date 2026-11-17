import { Project, SocialPost } from '../../types/kaizen';
import {
  CommercialScript,
  CommercialScriptChannel,
  ModelTemplate,
  ModelTemplateDomain,
  ResourceFile,
  ResourceFileStatus,
} from '../../types/resources';
import { resolveEffectiveClientIdForFile } from './filesService';

export interface ResourceFileFilterParams {
  query?: string;
  categoryId?: string;
  clientId?: string;
  projectId?: string;
  folderId?: string | 'ALL';
  extension?: string;
  tag?: string;
  favoritesOnly?: boolean;
  status?: ResourceFileStatus | 'all';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
}

export function filterResourceFiles(
  files: ResourceFile[],
  filters: ResourceFileFilterParams,
  projects: Project[] = [],
  socialPosts: SocialPost[] = []
): ResourceFile[] {
  const q = (filters.query || '').trim().toLowerCase();
  const tagFilter = (filters.tag || '').trim().toLowerCase();
  const statusFilter = filters.status || 'ativo';

  return files.filter((file) => {
    if (statusFilter !== 'all' && file.status !== statusFilter) return false;
    if (filters.favoritesOnly && !file.favorite) return false;
    if (filters.categoryId && file.categoryId !== filters.categoryId) return false;
    if (filters.extension && file.extension !== filters.extension) return false;

    if (filters.folderId && filters.folderId !== 'ALL') {
      if ((file.folderId || '') !== filters.folderId) return false;
    }

    if (filters.clientId) {
      const effectiveClientId = resolveEffectiveClientIdForFile(file, projects, socialPosts);
      if (effectiveClientId !== filters.clientId && file.clientId !== filters.clientId) {
        return false;
      }
    }

    if (filters.projectId && file.projectId !== filters.projectId) {
      return false;
    }

    if (tagFilter && !file.tags.some((t) => t.toLowerCase().includes(tagFilter))) {
      return false;
    }

    const uploadedDate = (file.uploadedAt || '').slice(0, 10);
    if (filters.dateFrom && uploadedDate && uploadedDate < filters.dateFrom) return false;
    if (filters.dateTo && uploadedDate && uploadedDate > filters.dateTo) return false;

    if (q) {
      const haystack = [
        file.name,
        file.originalName,
        file.description || '',
        file.extension,
        file.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export interface CommercialScriptFilterParams {
  query?: string;
  categoryId?: string;
  channel?: CommercialScriptChannel | '';
  favoritesOnly?: boolean;
  status?: 'ativo' | 'arquivado' | 'all';
}

export function filterCommercialScripts(
  scripts: CommercialScript[],
  filters: CommercialScriptFilterParams
): CommercialScript[] {
  const q = (filters.query || '').trim().toLowerCase();
  const statusFilter = filters.status || 'ativo';

  return scripts.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (filters.favoritesOnly && !s.favorite) return false;
    if (filters.categoryId && s.categoryId !== filters.categoryId) return false;
    if (filters.channel && s.channel !== filters.channel) return false;
    if (q) {
      const haystack = [s.title, s.description || '', s.content, s.tags.join(' ')]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export interface ModelTemplateFilterParams {
  query?: string;
  domain?: ModelTemplateDomain | '';
  kind?: string;
  favoritesOnly?: boolean;
  status?: 'ativo' | 'arquivado' | 'all';
}

export function filterModelTemplates(
  templates: ModelTemplate[],
  filters: ModelTemplateFilterParams
): ModelTemplate[] {
  const q = (filters.query || '').trim().toLowerCase();
  const statusFilter = filters.status || 'ativo';

  return templates.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (filters.favoritesOnly && !t.favorite) return false;
    if (filters.domain && t.domain !== filters.domain) return false;
    if (filters.kind && t.kind !== filters.kind) return false;
    if (q) {
      const haystack = [t.title, t.description || '', t.content, t.tags.join(' ')]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export interface PaginationResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = 12
): PaginationResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (currentPage - 1) * safePageSize;
  return {
    items: items.slice(startIdx, startIdx + safePageSize),
    totalItems,
    totalPages,
    currentPage,
    pageSize: safePageSize,
  };
}
