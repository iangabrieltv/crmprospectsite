import React, { useMemo, useState } from 'react';
import { Client, Project, SocialPost } from '../../types/kaizen';
import {
  ALLOWED_FILE_EXTENSIONS,
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from '../../types/resources';
import {
  filterResourceFiles,
  formatFileSize,
  getFolderBreadcrumbs,
  paginateItems,
  resolveEffectiveClientIdForFile,
  resolveResourceBlob,
} from '../../services/resources';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';
import {
  Archive,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react';

interface FilesDocumentsTabProps {
  files: ResourceFile[];
  folders: ResourceFolder[];
  categories: ResourceCategory[];
  clients: Client[];
  projects: Project[];
  socialPosts: SocialPost[];
  externalQuery?: string;
  onOpenUpload: (folderId?: string) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void> | void;
  onPreviewFile: (file: ResourceFile) => void;
  onEditFile: (file: ResourceFile) => void;
  onToggleFavorite: (file: ResourceFile) => Promise<void> | void;
  onArchiveToggle: (file: ResourceFile) => Promise<void> | void;
  onDeleteRequest: (file: ResourceFile) => void;
}

export const FilesDocumentsTab: React.FC<FilesDocumentsTabProps> = ({
  files,
  folders,
  categories,
  clients,
  projects,
  socialPosts,
  externalQuery = '',
  onOpenUpload,
  onCreateFolder,
  onPreviewFile,
  onEditFile,
  onToggleFavorite,
  onArchiveToggle,
  onDeleteRequest,
}) => {
  const [query, setQuery] = useState(externalQuery);
  const [categoryId, setCategoryId] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [extension, setExtension] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'arquivado' | 'all'>('ativo');
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [folderModeAll, setFolderModeAll] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [page, setPage] = useState(1);

  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const effectiveQuery = query || externalQuery;

  const fileCategories = useMemo(
    () => categories.filter((c) => c.kind === 'arquivo'),
    [categories]
  );

  const breadcrumbs = useMemo(
    () => (folderModeAll ? [] : getFolderBreadcrumbs(folders, currentFolderId || undefined)),
    [folders, currentFolderId, folderModeAll]
  );

  const childFolders = useMemo(
    () =>
      folderModeAll
        ? folders.filter((f) => !f.parentId)
        : folders.filter((f) => (f.parentId || '') === currentFolderId),
    [folders, currentFolderId, folderModeAll]
  );

  const filteredFiles = useMemo(
    () =>
      filterResourceFiles(
        files,
        {
          query: effectiveQuery,
          categoryId: categoryId || undefined,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          folderId: folderModeAll ? 'ALL' : currentFolderId,
          extension: extension || undefined,
          tag: tagFilter || undefined,
          favoritesOnly,
          status: statusFilter,
        },
        projects,
        socialPosts
      ),
    [
      files,
      effectiveQuery,
      categoryId,
      clientId,
      projectId,
      folderModeAll,
      currentFolderId,
      extension,
      tagFilter,
      favoritesOnly,
      statusFilter,
      projects,
      socialPosts,
    ]
  );

  const paginated = useMemo(() => paginateItems(filteredFiles, page, 10), [filteredFiles, page]);

  const handleDownloadFile = async (file: ResourceFile) => {
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
      onPreviewFile(file);
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

  const handleCreateQuickFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), folderModeAll ? undefined : currentFolderId || undefined);
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  return (
    <div className="space-y-5">
      {/* Barra de Ações e Navegação de Pastas */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setFolderModeAll(true);
                setCurrentFolderId('');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                folderModeAll
                  ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] border border-[var(--kz-accent)]/35'
                  : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
              }`}
            >
              Todos os Arquivos ({files.filter((f) => f.status === 'ativo').length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFolderModeAll(false);
                setCurrentFolderId('');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition cursor-pointer ${
                !folderModeAll && !currentFolderId
                  ? 'bg-[var(--kz-accent)]/15 text-[var(--kz-accent-text)] border border-[var(--kz-accent)]/35'
                  : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
              }`}
            >
              Raiz das Pastas
            </button>
            {breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--kz-text-muted)]" />
                <button
                  type="button"
                  onClick={() => {
                    setFolderModeAll(false);
                    setCurrentFolderId(crumb.id);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                    currentFolderId === crumb.id
                      ? 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)]'
                      : 'text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)]'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewFolderInput((prev) => !prev)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Nova Pasta
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenUpload(folderModeAll ? undefined : currentFolderId || undefined)}
            >
              <Plus className="h-3.5 w-3.5" />
              Enviar Arquivo
            </Button>
          </div>
        </div>

        {showNewFolderInput && (
          <form
            onSubmit={handleCreateQuickFolder}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/60 p-3"
          >
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Nome da nova pasta"
                placeholder="Ex.: Identidade Visual · Clientes 2026"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Criar Pasta
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowNewFolderInput(false)}
            >
              Cancelar
            </Button>
          </form>
        )}

        {/* Subpastas clicáveis */}
        {childFolders.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {childFolders.map((folder) => {
              const count = files.filter(
                (f) => f.folderId === folder.id && f.status === 'ativo'
              ).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setFolderModeAll(false);
                    setCurrentFolderId(folder.id);
                    setPage(1);
                  }}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/60 px-3 py-2 text-left transition hover:border-[var(--kz-accent)]/50 hover:bg-[var(--kz-bg-subtle)] cursor-pointer"
                >
                  <Folder className="h-4 w-4 shrink-0 text-[var(--kz-accent)]" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--kz-text-primary)]">
                      {folder.name}
                    </p>
                    <p className="text-[10px] text-[var(--kz-text-muted)] tabular-nums">
                      {count} arquivo(s)
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Filtros Avançados */}
        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-[var(--kz-border-subtle)] sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2 relative">
            <Input
              placeholder="Buscar por nome, descrição ou tag..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-3.5 w-3.5" />}
            />
          </div>

          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as categorias</option>
            {fileCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>

          <Select
            value={extension}
            onChange={(e) => {
              setExtension(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os formatos</option>
            {ALLOWED_FILE_EXTENSIONS.map((ext) => (
              <option key={ext} value={ext}>
                .{ext.toUpperCase()}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ativo' | 'arquivado' | 'all');
              setPage(1);
            }}
          >
            <option value="ativo">Ativos</option>
            <option value="arquivado">Arquivados</option>
            <option value="all">Todos</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Input
              placeholder="Filtrar tag..."
              value={tagFilter}
              onChange={(e) => {
                setTagFilter(e.target.value);
                setPage(1);
              }}
              className="w-40"
            />

            <button
              type="button"
              onClick={() => {
                setFavoritesOnly((prev) => !prev);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                favoritesOnly
                  ? 'border-[#C6A15B]/50 bg-[#C6A15B]/15 text-[#D9BC7E]'
                  : 'border-[var(--kz-border-subtle)] text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-[#D9BC7E]' : ''}`} />
              Somente Favoritos
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded p-1.5 transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)]'
                  : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
              }`}
              title="Visualização em lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded p-1.5 transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)]'
                  : 'text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
              }`}
              title="Visualização em cards"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Lista ou Cards de Arquivos */}
      {paginated.totalItems === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Nenhum arquivo encontrado com os filtros atuais"
          description="Envie um novo documento, selecione outra pasta ou limpe os filtros de busca."
          action={
            <Button variant="primary" size="sm" onClick={() => onOpenUpload()}>
              <Plus className="h-3.5 w-3.5" />
              Enviar Primeiro Arquivo
            </Button>
          }
        />
      ) : viewMode === 'list' ? (
        <Card className="p-4 space-y-3">
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Formato / Tam.</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Cliente / Projeto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.items.map((file) => {
                  const cat = categories.find((c) => c.id === file.categoryId);
                  const proj = file.projectId
                    ? projects.find((p) => p.id === file.projectId)
                    : null;
                  const effClientId = resolveEffectiveClientIdForFile(
                    file,
                    projects,
                    socialPosts
                  );
                  const cli = effClientId
                    ? clients.find((c) => c.id === effClientId)
                    : null;

                  return (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => onToggleFavorite(file)}
                            className="mt-0.5 text-[var(--kz-text-muted)] hover:text-[#D9BC7E] cursor-pointer"
                            title="Favoritar"
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${
                                file.favorite ? 'fill-[#D9BC7E] text-[#D9BC7E]' : ''
                              }`}
                            />
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onPreviewFile(file)}
                              className="text-left text-xs font-semibold text-[var(--kz-text-primary)] hover:text-[var(--kz-accent-text)] cursor-pointer"
                            >
                              {file.name}
                            </button>
                            <p className="text-[11px] text-[var(--kz-text-muted)] truncate max-w-[260px]">
                              {file.originalName}
                            </p>
                            {file.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {file.tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="rounded border border-[var(--kz-border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--kz-text-muted)]"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        <Badge variant="neutral">.{file.extension.toUpperCase()}</Badge>
                        <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
                          {formatFileSize(file.sizeBytes)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--kz-text-secondary)]">
                        {cat?.name || 'Sem categoria'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {cli ? (
                          <div className="text-[var(--kz-text-primary)] font-medium">
                            {cli.companyName}
                          </div>
                        ) : (
                          <span className="text-[var(--kz-text-muted)]">Interno</span>
                        )}
                        {proj && (
                          <div className="text-[11px] text-[var(--kz-text-muted)]">
                            Projeto: {proj.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-[var(--kz-text-secondary)]">
                        {new Date(file.uploadedAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onPreviewFile(file)}
                            title="Visualizar e consultar informações"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleDownloadFile(file)}
                            title="Baixar arquivo"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onEditFile(file)}
                            title="Editar metadados / renomear"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onArchiveToggle(file)}
                            title={file.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                          >
                            {file.status === 'arquivado' ? (
                              <RotateCcw className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onDeleteRequest(file)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            currentPage={paginated.currentPage}
            totalPages={paginated.totalPages}
            totalItems={paginated.totalItems}
            pageSize={paginated.pageSize}
            onPageChange={setPage}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.items.map((file) => {
              const cat = categories.find((c) => c.id === file.categoryId);
              const effClientId = resolveEffectiveClientIdForFile(
                file,
                projects,
                socialPosts
              );
              const cli = effClientId ? clients.find((c) => c.id === effClientId) : null;
              return (
                <Card key={file.id} className="p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="neutral">.{file.extension.toUpperCase()}</Badge>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(file)}
                        className="text-[var(--kz-text-muted)] hover:text-[#D9BC7E] cursor-pointer"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            file.favorite ? 'fill-[#D9BC7E] text-[#D9BC7E]' : ''
                          }`}
                        />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPreviewFile(file)}
                      className="text-left text-sm font-semibold text-[var(--kz-text-primary)] hover:text-[var(--kz-accent-text)] line-clamp-2 cursor-pointer"
                    >
                      {file.name}
                    </button>
                    <p className="text-xs text-[var(--kz-text-muted)] truncate">
                      {cat?.name || 'Sem categoria'} · {formatFileSize(file.sizeBytes)}
                    </p>
                    {cli && (
                      <p className="text-xs text-[var(--kz-text-secondary)] truncate">
                        Cliente: {cli.companyName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--kz-border-subtle)] pt-3">
                    <Button size="xs" variant="secondary" onClick={() => onPreviewFile(file)}>
                      <Eye className="h-3.5 w-3.5" />
                      Abrir
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="ghost" onClick={() => handleDownloadFile(file)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => onEditFile(file)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => onDeleteRequest(file)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination
            currentPage={paginated.currentPage}
            totalPages={paginated.totalPages}
            totalItems={paginated.totalItems}
            pageSize={paginated.pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};
