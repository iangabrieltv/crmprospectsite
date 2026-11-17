import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Client, Project } from '../../types/kaizen';
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_UPLOAD_FILE_BYTES,
  RESOURCE_CLIENT_SECTIONS,
  RESOURCE_PROJECT_SECTIONS,
  ResourceCategory,
  ResourceClientSection,
  ResourceFile,
  ResourceFolder,
  ResourceProjectSection,
} from '../../types/resources';
import {
  createUploadedResourceFile,
  formatFileSize,
  generateResourceFileId,
  normalizeTags,
  validateUploadFile,
} from '../../services/resources';
import { Alert, Button, Input, Modal, Select, Textarea } from '../ui';
import {
  FileUp,
  FolderOpen,
  Link2,
  ShieldAlert,
  Star,
  UploadCloud,
} from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ResourceCategory[];
  folders: ResourceFolder[];
  clients: Client[];
  projects: Project[];
  userName: string;
  editingFile?: ResourceFile | null;
  defaultFolderId?: string;
  defaultClientId?: string;
  defaultProjectId?: string;
  defaultClientSection?: ResourceClientSection;
  defaultProjectSection?: ResourceProjectSection;
  onSaveFile: (file: ResourceFile, mode: 'create' | 'edit') => Promise<void> | void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  categories,
  folders,
  clients,
  projects,
  userName,
  editingFile = null,
  defaultFolderId,
  defaultClientId,
  defaultProjectId,
  defaultClientSection,
  defaultProjectSection,
  onSaveFile,
}) => {
  const isEditing = Boolean(editingFile);
  const fileCategories = useMemo(
    () => categories.filter((c) => c.kind === 'arquivo' && c.active),
    [categories]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<'upload' | 'external_link'>('upload');
  const [selectedBrowserFile, setSelectedBrowserFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalFileName, setExternalFileName] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [categoryId, setCategoryId] = useState('cat-doc-interno');
  const [folderId, setFolderId] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [favorite, setFavorite] = useState(false);

  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientSection, setClientSection] = useState<ResourceClientSection | ''>('');
  const [projectSection, setProjectSection] = useState<ResourceProjectSection | ''>('');

  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setNoticeMsg(null);
    setUploadProgress(0);
    setSelectedBrowserFile(null);

    if (editingFile) {
      setSourceMode(
        editingFile.storageProvider === 'external_link' ? 'external_link' : 'upload'
      );
      setExternalUrl(editingFile.downloadUrl || '');
      setExternalFileName(editingFile.originalName);
      setDisplayName(editingFile.name);
      setCategoryId(editingFile.categoryId || fileCategories[0]?.id || 'cat-doc-interno');
      setFolderId(editingFile.folderId || '');
      setDescription(editingFile.description || '');
      setTagsText((editingFile.tags || []).join(', '));
      setFavorite(Boolean(editingFile.favorite));
      setClientId(editingFile.clientId || '');
      setProjectId(editingFile.projectId || '');
      setClientSection(editingFile.clientSection || '');
      setProjectSection(editingFile.projectSection || '');
    } else {
      const matchedProject = defaultProjectId
        ? projects.find((p) => p.id === defaultProjectId)
        : undefined;
      setSourceMode('upload');
      setExternalUrl('');
      setExternalFileName('');
      setDisplayName('');
      setCategoryId(
        defaultProjectId
          ? 'cat-doc-projeto'
          : defaultClientId
          ? 'cat-doc-cliente'
          : fileCategories[0]?.id || 'cat-doc-interno'
      );
      setFolderId(defaultFolderId || '');
      setDescription('');
      setTagsText('');
      setFavorite(false);
      setClientId(defaultClientId || matchedProject?.clientId || '');
      setProjectId(defaultProjectId || '');
      setClientSection(defaultClientSection || '');
      setProjectSection(defaultProjectSection || '');
    }
  }, [
    isOpen,
    editingFile,
    defaultFolderId,
    defaultClientId,
    defaultProjectId,
    defaultClientSection,
    defaultProjectSection,
    projects,
    fileCategories,
  ]);

  const availableProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((p) => p.clientId === clientId);
  }, [projects, clientId]);

  const handleProjectSelect = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    if (nextProjectId) {
      const proj = projects.find((p) => p.id === nextProjectId);
      if (proj?.clientId && !clientId) {
        setClientId(proj.clientId);
      }
    }
  };

  const handlePickedFile = (picked: File | null) => {
    setErrorMsg(null);
    if (!picked) return;
    const validation = validateUploadFile({
      name: picked.name,
      size: picked.size,
      type: picked.type,
    });
    if (!validation.ok) {
      setErrorMsg(validation.error || 'Arquivo inválido.');
      setSelectedBrowserFile(null);
      return;
    }
    setSelectedBrowserFile(picked);
    if (!displayName.trim()) {
      setDisplayName(picked.name.replace(/\.[^/.]+$/, '').trim() || picked.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);

    if (isEditing && editingFile) {
      if (!displayName.trim()) {
        setErrorMsg('Informe um nome para o arquivo.');
        return;
      }
      setIsSubmitting(true);
      try {
        const updated: ResourceFile = {
          ...editingFile,
          name: displayName.trim(),
          categoryId,
          folderId: folderId || undefined,
          description: description.trim() || undefined,
          tags: normalizeTags(tagsText),
          favorite,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          clientSection: clientSection || undefined,
          projectSection: projectSection || undefined,
          downloadUrl:
            editingFile.storageProvider === 'external_link' && externalUrl.trim()
              ? externalUrl.trim()
              : editingFile.downloadUrl,
          updatedAt: new Date().toISOString(),
        };
        await onSaveFile(updated, 'edit');
        onClose();
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Erro ao atualizar metadados do arquivo.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (sourceMode === 'upload') {
      if (!selectedBrowserFile) {
        setErrorMsg('Selecione um arquivo válido para enviar.');
        return;
      }
      setIsSubmitting(true);
      try {
        const outcome = await createUploadedResourceFile({
          file: {
            name: selectedBrowserFile.name,
            size: selectedBrowserFile.size,
            type: selectedBrowserFile.type,
            data: selectedBrowserFile,
          },
          displayName: displayName.trim() || undefined,
          categoryId,
          description: description.trim() || undefined,
          tags: tagsText,
          folderId: folderId || undefined,
          favorite,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          clientSection: clientSection || undefined,
          projectSection: projectSection || undefined,
          uploadedBy: userName || 'Ian',
          onProgress: (pct) => setUploadProgress(pct),
        });

        if (!outcome.ok || !outcome.file) {
          setErrorMsg(outcome.error || 'Não foi possível concluir o envio do arquivo.');
          return;
        }

        await onSaveFile(outcome.file, 'create');
        if (outcome.notice) {
          setNoticeMsg(outcome.notice);
        }
        onClose();
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Erro inesperado ao salvar o arquivo.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Modo link externo (ex.: arquivo grande já hospedado em Google Drive / CDN privada)
    const trimmedUrl = externalUrl.trim();
    const trimmedRefName = externalFileName.trim() || `${displayName.trim() || 'material'}.pdf`;
    if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
      setErrorMsg('Informe uma URL válida iniciando com https:// ou http://.');
      return;
    }

    const linkValidation = validateUploadFile({
      name: trimmedRefName,
      size: 1024,
    });
    if (!linkValidation.ok || !linkValidation.extension) {
      setErrorMsg(
        linkValidation.error ||
          'Inclua uma extensão suportada no nome de referência (ex.: briefing-cliente.pdf).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const fileId = generateResourceFileId();
      const payload: ResourceFile = {
        id: fileId,
        name: displayName.trim() || trimmedRefName.replace(/\.[^/.]+$/, ''),
        originalName: trimmedRefName,
        mimeType: linkValidation.mimeType || 'application/octet-stream',
        extension: linkValidation.extension,
        sizeBytes: 1024,
        categoryId,
        description: description.trim() || undefined,
        tags: normalizeTags(tagsText),
        folderId: folderId || undefined,
        favorite,
        status: 'ativo',
        clientId: clientId || undefined,
        projectId: projectId || undefined,
        clientSection: clientSection || undefined,
        projectSection: projectSection || undefined,
        storagePath: `external/${fileId}`,
        storageProvider: 'external_link',
        downloadUrl: trimmedUrl,
        uploadedBy: userName || 'Ian',
        uploadedAt: nowIso,
        schemaVersion: 1,
        updatedAt: nowIso,
      };
      await onSaveFile(payload, 'create');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao registrar vínculo externo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Informações do Arquivo' : 'Cadastrar Novo Material / Arquivo'}
      subtitle={
        isEditing
          ? 'Atualize nome, categoria, etiquetas, pasta ou vínculos com clientes e projetos.'
          : 'Envie arquivos reais (até 25 MB) com bloqueio automático de formatos executáveis.'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <Alert variant="danger" title="Envio bloqueado / erro de validação">
            {errorMsg}
          </Alert>
        )}

        {noticeMsg && (
          <Alert variant="info" title="Aviso de Armazenamento">
            {noticeMsg}
          </Alert>
        )}

        {!isEditing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--kz-border)] pb-3">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('upload');
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  sourceMode === 'upload'
                    ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent)] border border-[var(--kz-accent)]/35'
                    : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-surface-hover)] border border-transparent'
                }`}
              >
                <FileUp className="h-3.5 w-3.5" />
                Upload de Arquivo Local
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('external_link');
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  sourceMode === 'external_link'
                    ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent)] border border-[var(--kz-accent)]/35'
                    : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-surface-hover)] border border-transparent'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                Referência por Link Externo
              </button>
            </div>

            {sourceMode === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0] || null;
                  handlePickedFile(dropped);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border border-dashed p-5 text-center transition ${
                  isDragging
                    ? 'border-[var(--kz-accent)] bg-[var(--kz-accent)]/10'
                    : 'border-[var(--kz-border-strong)] bg-[var(--kz-bg)]/60 hover:border-[var(--kz-accent)]/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
                  onChange={(e) => handlePickedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <UploadCloud className="mx-auto mb-2 h-8 w-8 text-[var(--kz-accent)]" />
                {selectedBrowserFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--kz-text-primary)]">
                      {selectedBrowserFile.name}
                    </p>
                    <p className="text-xs text-[var(--kz-text-secondary)]">
                      {formatFileSize(selectedBrowserFile.size)} · Clique para substituir
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--kz-text-primary)]">
                      Clique ou arraste o arquivo aqui
                    </p>
                    <p className="text-xs text-[var(--kz-text-muted)]">
                      Permitidos: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG, JPG/JPEG, SVG, MP4,
                      TXT, CSV, ZIP (máx. {(MAX_UPLOAD_FILE_BYTES / (1024 * 1024)).toFixed(0)}{' '}
                      MB)
                    </p>
                  </div>
                )}
                {isSubmitting && uploadProgress > 0 && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--kz-border)]">
                    <div
                      className="h-full bg-[var(--kz-accent)] transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="URL do Arquivo *"
                  placeholder="https://drive.google.com/..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
                <Input
                  label="Nome de Referência com Extensão *"
                  placeholder="manual-da-marca.pdf"
                  value={externalFileName}
                  onChange={(e) => setExternalFileName(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome de Exibição *"
            placeholder="Ex.: Contrato Social Atualizado"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Select
            label="Categoria *"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {fileCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Pasta Organizacional"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">Raiz da Central (sem pasta)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>

          <Input
            label="Etiquetas / Tags (separadas por vírgula)"
            placeholder="branding, briefing, contrato, social"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-[var(--kz-border)] bg-[var(--kz-bg)]/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--kz-text-secondary)]">
              <FolderOpen className="h-3.5 w-3.5 text-[var(--kz-accent)]" />
              Vínculo com Cliente e Projeto
            </span>
            <span className="text-[11px] text-[var(--kz-text-muted)]">
              Arquivos de projeto aparecem automaticamente no cliente sem duplicação
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Cliente Vinculado"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                if (projectId) {
                  const proj = projects.find((p) => p.id === projectId);
                  if (proj && e.target.value && proj.clientId !== e.target.value) {
                    setProjectId('');
                  }
                }
              }}
            >
              <option value="">Nenhum (material interno)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>

            <Select
              label="Seção no Cliente"
              value={clientSection}
              onChange={(e) =>
                setClientSection(e.target.value as ResourceClientSection | '')
              }
            >
              <option value="">Classificação automática</option>
              {RESOURCE_CLIENT_SECTIONS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </Select>

            <Select
              label="Projeto Vinculado"
              value={projectId}
              onChange={(e) => handleProjectSelect(e.target.value)}
            >
              <option value="">Nenhum projeto específico</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              label="Seção no Projeto"
              value={projectSection}
              onChange={(e) =>
                setProjectSection(e.target.value as ResourceProjectSection | '')
              }
              disabled={!projectId}
            >
              <option value="">Classificação automática</option>
              {RESOURCE_PROJECT_SECTIONS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Textarea
          label="Descrição / Observações"
          rows={3}
          placeholder="Contexto de uso, versão aprovada ou orientações para a equipe..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--kz-border)]">
          <button
            type="button"
            onClick={() => setFavorite((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              favorite
                ? 'border-[#C6A15B]/50 bg-[#C6A15B]/15 text-[#D9BC7E]'
                : 'border-[var(--kz-border)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-surface-hover)]'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${favorite ? 'fill-[#D9BC7E]' : ''}`} />
            {favorite ? 'Marcado como Favorito' : 'Marcar como Favorito'}
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--kz-text-muted)]">
              <ShieldAlert className="h-3.5 w-3.5" />
              Executáveis bloqueados
            </span>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting
                ? 'Salvando...'
                : isEditing
                ? 'Salvar Alterações'
                : 'Salvar Arquivo'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
