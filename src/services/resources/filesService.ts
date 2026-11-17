import { Project, SocialPost } from '../../types/kaizen';
import {
  AllowedFileExtension,
  ResourceClientSection,
  ResourceFile,
  ResourceFolder,
  ResourceFolderScope,
  ResourceProjectSection,
} from '../../types/resources';
import { validateUploadFile } from './fileValidation';
import {
  StorageDriver,
  StorageUploadMode,
  defaultFirebaseStorageDriver,
  removeResourceBinary,
  uploadResourceBinary,
} from './firebaseStorageAdapter';

export function generateResourceFileId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `rfile-${Date.now()}-${rand}`;
}

export function generateResourceFolderId(): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `rfold-${Date.now()}-${rand}`;
}

export function normalizeTags(tagsInput: string[] | string | undefined): string[] {
  const rawList = Array.isArray(tagsInput)
    ? tagsInput
    : typeof tagsInput === 'string'
    ? tagsInput.split(',')
    : [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const tag of rawList) {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      clean.push(trimmed.slice(0, 40));
    }
    if (clean.length >= 20) break;
  }
  return clean;
}

export interface UploadResourceFileInput {
  file: {
    name: string;
    size: number;
    type?: string;
    data: Blob | File | ArrayBuffer | Uint8Array;
  };
  displayName?: string;
  categoryId: string;
  description?: string;
  tags?: string[] | string;
  folderId?: string;
  favorite?: boolean;
  clientId?: string;
  projectId?: string;
  proposalId?: string;
  linkedTaskIds?: string[];
  linkedSocialPostIds?: string[];
  clientSection?: ResourceClientSection;
  projectSection?: ResourceProjectSection;
  uploadedBy: string;
  storageMode?: StorageUploadMode;
  onProgress?: (percent: number) => void;
}

export interface UploadResourceFileOutcome {
  ok: boolean;
  file?: ResourceFile;
  error?: string;
  notice?: string;
}

export async function createUploadedResourceFile(
  input: UploadResourceFileInput,
  driver: StorageDriver = defaultFirebaseStorageDriver
): Promise<UploadResourceFileOutcome> {
  const validation = validateUploadFile({
    name: input.file.name,
    size: input.file.size,
    type: input.file.type,
  });

  if (!validation.ok || !validation.extension || !validation.sanitizedOriginalName) {
    return { ok: false, error: validation.error || 'Arquivo inválido para envio.' };
  }

  const fileId = generateResourceFileId();
  const uploadResult = await uploadResourceBinary(
    {
      fileId,
      sanitizedOriginalName: validation.sanitizedOriginalName,
      mimeType: validation.mimeType || 'application/octet-stream',
      data: input.file.data,
      mode: input.storageMode || 'auto',
      onProgress: input.onProgress,
    },
    driver
  );

  if (!uploadResult.ok) {
    return {
      ok: false,
      error:
        uploadResult.cloudError ||
        'Falha ao enviar o arquivo para o armazenamento configurado.',
    };
  }

  const nowIso = new Date().toISOString();
  const fallbackBaseName = input.file.name.replace(/\.[^/.]+$/, '').trim() || input.file.name;
  const resolvedName = (input.displayName || fallbackBaseName).trim();

  const resourceFile: ResourceFile = {
    id: fileId,
    name: resolvedName,
    originalName: input.file.name.trim(),
    mimeType: validation.mimeType || 'application/octet-stream',
    extension: validation.extension as AllowedFileExtension,
    sizeBytes: uploadResult.sizeBytes ?? input.file.size,
    categoryId: input.categoryId || 'cat-doc-interno',
    description: input.description?.trim() || undefined,
    tags: normalizeTags(input.tags),
    folderId: input.folderId || undefined,
    favorite: Boolean(input.favorite),
    status: 'ativo',
    clientId: input.clientId || undefined,
    projectId: input.projectId || undefined,
    proposalId: input.proposalId || undefined,
    linkedTaskIds: input.linkedTaskIds?.length ? [...new Set(input.linkedTaskIds)] : undefined,
    linkedSocialPostIds: input.linkedSocialPostIds?.length
      ? [...new Set(input.linkedSocialPostIds)]
      : undefined,
    clientSection: input.clientSection || undefined,
    projectSection: input.projectSection || undefined,
    storagePath: uploadResult.storagePath,
    storageProvider: uploadResult.storageProvider,
    downloadUrl: uploadResult.downloadUrl || undefined,
    localBlobKey: uploadResult.localBlobKey || undefined,
    checksum: uploadResult.checksum || undefined,
    uploadedBy: input.uploadedBy || 'Ian',
    uploadedAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };

  return {
    ok: true,
    file: resourceFile,
    notice: uploadResult.notice,
  };
}

/**
 * Resolve o cliente efetivo de um arquivo sem duplicá-lo fisicamente:
 * se o arquivo tem clientId direto, usa-o; se está vinculado a um projeto,
 * herda automaticamente o clientId do projeto correspondente.
 */
export function resolveEffectiveClientIdForFile(
  file: ResourceFile,
  projects: Project[],
  socialPosts: SocialPost[] = []
): string | undefined {
  if (file.clientId) return file.clientId;
  if (file.projectId) {
    const proj = projects.find((p) => p.id === file.projectId);
    if (proj?.clientId) return proj.clientId;
  }
  if (file.linkedSocialPostIds && file.linkedSocialPostIds.length > 0) {
    for (const postId of file.linkedSocialPostIds) {
      const post = socialPosts.find((p) => p.id === postId);
      if (post?.clientId) return post.clientId;
    }
  }
  return undefined;
}

/**
 * Retorna todos os arquivos pertencentes ao contexto de um cliente:
 * - vinculados diretamente ao cliente
 * - OU vinculados a qualquer projeto desse cliente (automaticamente, sem duplicação)
 * - OU vinculados a qualquer post social desse cliente
 */
export function getFilesForClientContext(
  files: ResourceFile[],
  clientId: string,
  projects: Project[],
  socialPosts: SocialPost[] = [],
  includeArchived: boolean = false
): ResourceFile[] {
  if (!clientId) return [];
  const clientProjectIds = new Set(
    projects.filter((p) => p.clientId === clientId).map((p) => p.id)
  );
  const clientPostIds = new Set(
    socialPosts.filter((p) => p.clientId === clientId).map((p) => p.id)
  );

  return files.filter((file) => {
    if (!includeArchived && file.status === 'arquivado') return false;
    if (file.clientId === clientId) return true;
    if (file.projectId && clientProjectIds.has(file.projectId)) return true;
    if (
      file.linkedSocialPostIds &&
      file.linkedSocialPostIds.some((pid) => clientPostIds.has(pid))
    ) {
      return true;
    }
    return false;
  });
}

export function getFilesForProjectContext(
  files: ResourceFile[],
  projectId: string,
  includeArchived: boolean = false
): ResourceFile[] {
  if (!projectId) return [];
  return files.filter((f) => {
    if (!includeArchived && f.status === 'arquivado') return false;
    return f.projectId === projectId;
  });
}

export function getFilesForTaskContext(
  files: ResourceFile[],
  taskId: string,
  includeArchived: boolean = false
): ResourceFile[] {
  if (!taskId) return [];
  return files.filter((f) => {
    if (!includeArchived && f.status === 'arquivado') return false;
    return Boolean(f.linkedTaskIds?.includes(taskId));
  });
}

export function getFilesForSocialPostContext(
  files: ResourceFile[],
  postId: string,
  includeArchived: boolean = false
): ResourceFile[] {
  if (!postId) return [];
  return files.filter((f) => {
    if (!includeArchived && f.status === 'arquivado') return false;
    return Boolean(f.linkedSocialPostIds?.includes(postId));
  });
}

export function inferClientSectionForFile(
  file: ResourceFile
): ResourceClientSection {
  if (file.clientSection) return file.clientSection;
  if (file.projectSection === 'artes') return 'imagens';
  if (file.projectSection === 'entregaveis' || file.projectSection === 'arquivos_finais') {
    return 'entregaveis';
  }
  if (file.categoryId === 'cat-doc-identidade') return 'identidade_visual';
  if (file.categoryId === 'cat-doc-comercial') {
    const lower = file.name.toLowerCase();
    if (lower.includes('contrat')) return 'contratos';
    if (lower.includes('propost')) return 'propostas';
    return 'briefings';
  }
  if (['png', 'jpg', 'jpeg', 'svg'].includes(file.extension)) return 'imagens';
  if (file.extension === 'mp4') return 'videos';
  return 'outros';
}

export function inferProjectSectionForFile(
  file: ResourceFile
): ResourceProjectSection {
  if (file.projectSection) return file.projectSection;
  if (['png', 'jpg', 'jpeg', 'svg'].includes(file.extension)) return 'artes';
  if (file.categoryId === 'cat-doc-referencia') return 'referencia';
  return 'documentos';
}

export function renameResourceFile(file: ResourceFile, nextName: string): ResourceFile {
  const trimmed = nextName.trim();
  if (!trimmed) return file;
  return {
    ...file,
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
}

export function toggleResourceFileFavorite(file: ResourceFile): ResourceFile {
  return {
    ...file,
    favorite: !file.favorite,
    updatedAt: new Date().toISOString(),
  };
}

export function archiveResourceFile(file: ResourceFile): ResourceFile {
  const nowIso = new Date().toISOString();
  return {
    ...file,
    status: 'arquivado',
    archivedAt: file.archivedAt || nowIso,
    updatedAt: nowIso,
  };
}

export function restoreResourceFile(file: ResourceFile): ResourceFile {
  return {
    ...file,
    status: 'ativo',
    archivedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function hasHistoricalLinks(file: ResourceFile): boolean {
  return Boolean(
    file.clientId ||
      file.projectId ||
      file.proposalId ||
      (file.linkedTaskIds && file.linkedTaskIds.length > 0) ||
      (file.linkedSocialPostIds && file.linkedSocialPostIds.length > 0)
  );
}

export function linkFileToTask(file: ResourceFile, taskId: string): ResourceFile {
  const current = new Set(file.linkedTaskIds || []);
  current.add(taskId);
  return {
    ...file,
    linkedTaskIds: Array.from(current),
    updatedAt: new Date().toISOString(),
  };
}

export function unlinkFileFromTask(file: ResourceFile, taskId: string): ResourceFile {
  const next = (file.linkedTaskIds || []).filter((id) => id !== taskId);
  return {
    ...file,
    linkedTaskIds: next.length > 0 ? next : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function linkFileToSocialPost(
  file: ResourceFile,
  postId: string,
  clientId?: string
): ResourceFile {
  const current = new Set(file.linkedSocialPostIds || []);
  current.add(postId);
  return {
    ...file,
    clientId: file.clientId || clientId || undefined,
    linkedSocialPostIds: Array.from(current),
    updatedAt: new Date().toISOString(),
  };
}

export function unlinkFileFromSocialPost(file: ResourceFile, postId: string): ResourceFile {
  const next = (file.linkedSocialPostIds || []).filter((id) => id !== postId);
  return {
    ...file,
    linkedSocialPostIds: next.length > 0 ? next : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export async function purgeResourceFileBinary(file: ResourceFile): Promise<void> {
  await removeResourceBinary(file);
}

export function createResourceFolder(params: {
  name: string;
  parentId?: string;
  scope?: ResourceFolderScope;
  clientId?: string;
  projectId?: string;
  description?: string;
}): ResourceFolder {
  const nowIso = new Date().toISOString();
  return {
    id: generateResourceFolderId(),
    name: params.name.trim(),
    parentId: params.parentId || undefined,
    scope: params.scope || 'geral',
    clientId: params.clientId || undefined,
    projectId: params.projectId || undefined,
    description: params.description?.trim() || undefined,
    createdAt: nowIso,
    schemaVersion: 1,
    updatedAt: nowIso,
  };
}

export function getFolderBreadcrumbs(
  folders: ResourceFolder[],
  folderId?: string
): ResourceFolder[] {
  if (!folderId) return [];
  const map = new Map(folders.map((f) => [f.id, f]));
  const chain: ResourceFolder[] = [];
  const visited = new Set<string>();
  let curr: string | undefined = folderId;
  while (curr && !visited.has(curr)) {
    visited.add(curr);
    const found = map.get(curr);
    if (!found) break;
    chain.unshift(found);
    curr = found.parentId;
  }
  return chain;
}

export function canDeleteFolder(
  folderId: string,
  folders: ResourceFolder[],
  files: ResourceFile[]
): { allowed: boolean; reason?: string } {
  const hasChildFolder = folders.some((f) => f.parentId === folderId);
  if (hasChildFolder) {
    return {
      allowed: false,
      reason: 'Esta pasta possui subpastas vinculadas. Mova ou remova as subpastas antes.',
    };
  }
  const hasFiles = files.some((f) => f.folderId === folderId);
  if (hasFiles) {
    return {
      allowed: false,
      reason: 'Esta pasta contém arquivos vinculados. Mova os arquivos para outra pasta antes de excluir.',
    };
  }
  return { allowed: true };
}
