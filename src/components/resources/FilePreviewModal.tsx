import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Client, Project, SocialPost, Task } from '../../types/kaizen';
import {
  FILE_FORMAT_LABELS,
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from '../../types/resources';
import {
  formatFileSize,
  getPreviewModeForExtension,
  resolveResourceBlob,
} from '../../services/resources';
import { Alert, Badge, Button, Input, Modal } from '../ui';
import {
  Archive,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  Info,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';

interface FilePreviewModalProps {
  file: ResourceFile | null;
  onClose: () => void;
  categories: ResourceCategory[];
  folders: ResourceFolder[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  socialPosts: SocialPost[];
  onEditMetadata: (file: ResourceFile) => void;
  onRenameFile: (file: ResourceFile, nextName: string) => Promise<void> | void;
  onToggleFavorite: (file: ResourceFile) => Promise<void> | void;
  onArchiveToggle: (file: ResourceFile) => Promise<void> | void;
  onDeleteRequest: (file: ResourceFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  categories,
  folders,
  clients,
  projects,
  tasks,
  socialPosts,
  onEditMetadata,
  onRenameFile,
  onToggleFavorite,
  onArchiveToggle,
  onDeleteRequest,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [sheetPreview, setSheetPreview] = useState<{
    sheetName: string;
    rows: string[][];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    setObjectUrl(null);
    setTextPreview(null);
    setSheetPreview(null);
    setLoadError(null);
    setIsRenaming(false);

    if (!file) return;
    setRenameDraft(file.name);

    const previewMode = getPreviewModeForExtension(file.extension);

    async function hydratePreview() {
      if (!file) return;
      if (file.storageProvider === 'external_link') {
        return;
      }

      setIsLoadingBlob(true);
      try {
        const res = await resolveResourceBlob(file);
        if (!active) return;

        if (!res.blob) {
          setLoadError(
            res.error ||
              'Conteúdo binário não disponível neste navegador para pré-visualização.'
          );
          return;
        }

        if (previewMode === 'text') {
          const text = await res.blob.text();
          if (!active) return;
          setTextPreview(text.slice(0, 60000));
        } else if (previewMode === 'spreadsheet') {
          const buf = await res.blob.arrayBuffer();
          const workbook = XLSX.read(buf, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          if (firstSheet) {
            const rawRows = XLSX.utils.sheet_to_json<unknown[]>(
              workbook.Sheets[firstSheet],
              { header: 1 }
            );
            const rows = rawRows
              .slice(0, 40)
              .map((r) =>
                Array.isArray(r) ? r.slice(0, 12).map((c) => String(c ?? '')) : []
              );
            if (!active) return;
            setSheetPreview({ sheetName: firstSheet, rows });
          }
        } else if (
          previewMode === 'image' ||
          previewMode === 'pdf' ||
          previewMode === 'video'
        ) {
          createdUrl = URL.createObjectURL(res.blob);
          setObjectUrl(createdUrl);
        }
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : 'Erro ao renderizar pré-visualização.'
        );
      } finally {
        if (active) setIsLoadingBlob(false);
      }
    }

    hydratePreview();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file]);

  if (!file) return null;

  const previewMode = getPreviewModeForExtension(file.extension);
  const category = categories.find((c) => c.id === file.categoryId);
  const folder = file.folderId ? folders.find((f) => f.id === file.folderId) : null;
  const linkedProject = file.projectId
    ? projects.find((p) => p.id === file.projectId)
    : null;
  const resolvedClientId = file.clientId || linkedProject?.clientId;
  const linkedClient = resolvedClientId
    ? clients.find((c) => c.id === resolvedClientId)
    : null;
  const linkedTasks = (file.linkedTaskIds || [])
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));
  const linkedPosts = (file.linkedSocialPostIds || [])
    .map((id) => socialPosts.find((p) => p.id === id))
    .filter((p): p is SocialPost => Boolean(p));

  const handleDownload = async () => {
    if (file.storageProvider === 'external_link' && file.downloadUrl) {
      const a = document.createElement('a');
      a.href = file.downloadUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }

    const res = await resolveResourceBlob(file);
    if (!res.blob) {
      setLoadError(
        res.error || 'Arquivo indisponível para download neste dispositivo.'
      );
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.originalName || `${file.name}.${file.extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCommitRename = async () => {
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === file.name) {
      setIsRenaming(false);
      return;
    }
    await onRenameFile(file, trimmed);
    setIsRenaming(false);
  };

  const providerLabel =
    file.storageProvider === 'firebase_storage'
      ? 'Firebase Storage'
      : file.storageProvider === 'indexeddb_dev'
      ? 'Cofre Local Dev (IndexedDB)'
      : 'Link Externo';

  return (
    <Modal
      isOpen={Boolean(file)}
      onClose={onClose}
      title={file.name}
      subtitle={`${FILE_FORMAT_LABELS[file.extension] || file.extension.toUpperCase()} · ${formatFileSize(file.sizeBytes)} · Enviado em ${new Date(file.uploadedAt).toLocaleDateString('pt-BR')}`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Barra de ações rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--kz-border)] bg-[var(--kz-bg)]/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleDownload}>
              {file.storageProvider === 'external_link' ? (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir Link
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Baixar Arquivo
                </>
              )}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggleFavorite(file)}
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  file.favorite ? 'fill-[#D9BC7E] text-[#D9BC7E]' : ''
                }`}
              />
              {file.favorite ? 'Favorito' : 'Favoritar'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRenaming((prev) => !prev)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Renomear
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onEditMetadata(file);
              }}
            >
              Editar Metadados / Vínculos
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchiveToggle(file)}
            >
              {file.status === 'arquivado' ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" />
                  Arquivar
                </>
              )}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDeleteRequest(file)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>
        </div>

        {isRenaming && (
          <div className="flex items-end gap-2 rounded-xl border border-[var(--kz-border)] bg-[var(--kz-surface-hover)]/40 p-3">
            <div className="flex-1">
              <Input
                label="Novo nome de exibição"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleCommitRename}>
              Salvar Nome
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsRenaming(false)}>
              Cancelar
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Área de pré-visualização honesta */}
          <div className="lg:col-span-2 rounded-xl border border-[var(--kz-border)] bg-[var(--kz-bg)] p-4 min-h-[320px] flex flex-col justify-center">
            {file.storageProvider === 'external_link' ? (
              <div className="text-center space-y-3 py-8">
                <ExternalLink className="mx-auto h-10 w-10 text-[var(--kz-accent)]" />
                <p className="text-sm font-medium text-[var(--kz-text-primary)]">
                  Material vinculado por URL externa
                </p>
                <p className="text-xs text-[var(--kz-text-secondary)] break-all max-w-md mx-auto">
                  {file.downloadUrl}
                </p>
                {file.downloadUrl && (
                  <a
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--kz-accent)] px-4 py-2 text-xs font-semibold text-black hover:opacity-90"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir em nova aba
                  </a>
                )}
              </div>
            ) : isLoadingBlob ? (
              <p className="text-center text-sm text-[var(--kz-text-secondary)]">
                Carregando pré-visualização real...
              </p>
            ) : loadError ? (
              <Alert variant="warning" title="Pré-visualização indisponível">
                {loadError}
              </Alert>
            ) : previewMode === 'image' && objectUrl ? (
              <div className="flex items-center justify-center max-h-[420px] overflow-hidden rounded-lg bg-black/40 p-2">
                <img
                  src={objectUrl}
                  alt={file.name}
                  className="max-h-[400px] w-auto object-contain rounded"
                />
              </div>
            ) : previewMode === 'pdf' && objectUrl ? (
              <iframe
                src={objectUrl}
                title={file.name}
                className="h-[440px] w-full rounded-lg border border-[var(--kz-border)] bg-white"
              />
            ) : previewMode === 'video' && objectUrl ? (
              <video
                controls
                src={objectUrl}
                className="max-h-[420px] w-full rounded-lg bg-black"
              />
            ) : previewMode === 'text' && textPreview !== null ? (
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-4 text-xs font-mono text-[var(--kz-text-primary)]">
                {textPreview}
              </pre>
            ) : previewMode === 'spreadsheet' && sheetPreview ? (
              <div className="space-y-2 overflow-auto max-h-[420px]">
                <div className="flex items-center gap-2 text-xs text-[var(--kz-text-secondary)]">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  Aba exibida: <strong className="text-[var(--kz-text-primary)]">{sheetPreview.sheetName}</strong> (até 40 linhas)
                </div>
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {sheetPreview.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx === 0
                            ? 'bg-[var(--kz-surface)] font-semibold text-[var(--kz-text-primary)]'
                            : 'border-t border-[var(--kz-border)] text-[var(--kz-text-secondary)]'
                        }
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="border border-[var(--kz-border)] px-2 py-1.5 whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center space-y-3 py-10 px-4">
                <FileText className="mx-auto h-10 w-10 text-[var(--kz-text-muted)]" />
                <p className="text-sm font-medium text-[var(--kz-text-primary)]">
                  Pré-visualização direta indisponível para .{file.extension} no navegador
                </p>
                <p className="text-xs text-[var(--kz-text-secondary)] max-w-md mx-auto">
                  Arquivos {file.extension.toUpperCase()} não possuem renderizador nativo seguro
                  embutido. Baixe o arquivo para abri-lo no aplicativo apropriado.
                </p>
                <Button variant="primary" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  Baixar {file.originalName}
                </Button>
              </div>
            )}
          </div>

          {/* Ficha técnica e vínculos */}
          <div className="rounded-xl border border-[var(--kz-border)] bg-[var(--kz-bg)]/50 p-4 space-y-4 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[var(--kz-text-primary)] uppercase tracking-wider text-[11px]">
              <Info className="h-3.5 w-3.5 text-[var(--kz-accent)]" />
              Informações do Arquivo
            </div>

            <dl className="space-y-2.5">
              <div>
                <dt className="text-[var(--kz-text-muted)]">Nome original</dt>
                <dd className="text-[var(--kz-text-primary)] break-all font-mono text-[11px]">
                  {file.originalName}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-[var(--kz-text-muted)]">Extensão</dt>
                  <dd className="text-[var(--kz-text-primary)] uppercase font-semibold">
                    .{file.extension}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--kz-text-muted)]">Tamanho</dt>
                  <dd className="text-[var(--kz-text-primary)] tabular-nums">
                    {formatFileSize(file.sizeBytes)}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-[var(--kz-text-muted)]">Categoria</dt>
                <dd className="text-[var(--kz-text-primary)]">
                  {category?.name || 'Sem categoria'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kz-text-muted)]">Pasta</dt>
                <dd className="inline-flex items-center gap-1.5 text-[var(--kz-text-primary)]">
                  <Folder className="h-3.5 w-3.5 text-[var(--kz-accent)]" />
                  {folder?.name || 'Raiz da Central'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kz-text-muted)]">Armazenamento</dt>
                <dd className="mt-0.5">
                  <Badge variant={file.storageProvider === 'firebase_storage' ? 'success' : 'info'}>
                    {providerLabel}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kz-text-muted)]">Caminho lógico</dt>
                <dd className="text-[var(--kz-text-secondary)] break-all font-mono text-[10px]">
                  {file.storagePath}
                </dd>
              </div>
              {file.description && (
                <div>
                  <dt className="text-[var(--kz-text-muted)]">Descrição</dt>
                  <dd className="text-[var(--kz-text-secondary)] whitespace-pre-wrap">
                    {file.description}
                  </dd>
                </div>
              )}
              {file.tags.length > 0 && (
                <div>
                  <dt className="text-[var(--kz-text-muted)] mb-1">Etiquetas</dt>
                  <dd className="flex flex-wrap gap-1">
                    {file.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-[var(--kz-border)] bg-[var(--kz-surface)] px-1.5 py-0.5 text-[10px] text-[var(--kz-text-secondary)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t border-[var(--kz-border)] pt-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--kz-text-secondary)]">
                Vínculos Ativos
              </p>
              <p className="text-[var(--kz-text-secondary)]">
                Cliente:{' '}
                <strong className="text-[var(--kz-text-primary)]">
                  {linkedClient ? linkedClient.companyName : 'Não vinculado'}
                </strong>
                {!file.clientId && linkedProject?.clientId && (
                  <span className="ml-1 text-[10px] text-[var(--kz-accent)]">
                    (herdado do projeto)
                  </span>
                )}
              </p>
              <p className="text-[var(--kz-text-secondary)]">
                Projeto:{' '}
                <strong className="text-[var(--kz-text-primary)]">
                  {linkedProject ? linkedProject.name : 'Não vinculado'}
                </strong>
              </p>
              {linkedTasks.length > 0 && (
                <p className="text-[var(--kz-text-secondary)]">
                  Tarefas: {linkedTasks.map((t) => t.title).join(', ')}
                </p>
              )}
              {linkedPosts.length > 0 && (
                <p className="text-[var(--kz-text-secondary)]">
                  Redes Sociais: {linkedPosts.map((p) => p.title).join(', ')}
                </p>
              )}
              <p className="text-[11px] text-[var(--kz-text-muted)]">
                Enviado por {file.uploadedBy}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
