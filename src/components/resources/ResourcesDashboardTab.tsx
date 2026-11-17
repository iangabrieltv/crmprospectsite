import React, { useMemo } from 'react';
import { Client, Project, SocialPost } from '../../types/kaizen';
import {
  CommercialScript,
  ModelTemplate,
  ResourceCategory,
  ResourceFile,
} from '../../types/resources';
import {
  formatFileSize,
  resolveEffectiveClientIdForFile,
} from '../../services/resources';
import { Badge, Button, Card, EmptyState } from '../ui';
import {
  Building2,
  Eye,
  FileText,
  FolderKanban,
  FolderOpen,
  Library,
  MessageSquareCode,
  Plus,
  Star,
} from 'lucide-react';

interface ResourcesDashboardTabProps {
  files: ResourceFile[];
  categories: ResourceCategory[];
  scripts: CommercialScript[];
  templates: ModelTemplate[];
  clients: Client[];
  projects: Project[];
  socialPosts: SocialPost[];
  onQuickUpload: () => void;
  onQuickCreateScript: () => void;
  onQuickCreateTemplate: () => void;
  onPreviewFile: (file: ResourceFile) => void;
  onNavigateSubTab: (
    subTab:
      | 'overview'
      | 'files'
      | 'clients_projects'
      | 'scripts'
      | 'templates'
      | 'categories'
  ) => void;
}

export const ResourcesDashboardTab: React.FC<ResourcesDashboardTabProps> = ({
  files,
  categories,
  scripts,
  templates,
  clients,
  projects,
  socialPosts,
  onQuickUpload,
  onQuickCreateScript,
  onQuickCreateTemplate,
  onPreviewFile,
  onNavigateSubTab,
}) => {
  const activeFiles = useMemo(
    () => files.filter((f) => f.status === 'ativo'),
    [files]
  );
  const activeScripts = useMemo(
    () => scripts.filter((s) => s.status === 'ativo'),
    [scripts]
  );
  const activeTemplates = useMemo(
    () => templates.filter((t) => t.status === 'ativo'),
    [templates]
  );

  const totalBytes = useMemo(
    () => activeFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0),
    [activeFiles]
  );

  const recentDocs = useMemo(
    () =>
      [...activeFiles]
        .sort(
          (a, b) =>
            new Date(b.uploadedAt || '').getTime() -
            new Date(a.uploadedAt || '').getTime()
        )
        .slice(0, 6),
    [activeFiles]
  );

  const favoriteFiles = useMemo(
    () => activeFiles.filter((f) => f.favorite).slice(0, 5),
    [activeFiles]
  );
  const favoriteScripts = useMemo(
    () => activeScripts.filter((s) => s.favorite).slice(0, 4),
    [activeScripts]
  );
  const favoriteTemplates = useMemo(
    () => activeTemplates.filter((t) => t.favorite).slice(0, 4),
    [activeTemplates]
  );

  const filesLinkedToClients = useMemo(
    () =>
      activeFiles.filter((f) =>
        Boolean(resolveEffectiveClientIdForFile(f, projects, socialPosts))
      ).length,
    [activeFiles, projects, socialPosts]
  );

  const filesLinkedToProjects = useMemo(
    () => activeFiles.filter((f) => Boolean(f.projectId)).length,
    [activeFiles]
  );

  const categoryBreakdown = useMemo(() => {
    const fileCats = categories.filter((c) => c.kind === 'arquivo');
    return fileCats
      .map((cat) => ({
        category: cat,
        count: activeFiles.filter((f) => f.categoryId === cat.id).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [categories, activeFiles]);

  const maxCatCount = Math.max(1, ...categoryBreakdown.map((c) => c.count));

  return (
    <div className="space-y-6">
      {/* Atalhos Principais */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--kz-border)] bg-[var(--kz-surface)] p-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--kz-text-primary)]">
            Ações Rápidas da Central
          </h3>
          <p className="text-xs text-[var(--kz-text-secondary)]">
            Cadastre novos materiais, roteiros comerciais ou modelos reutilizáveis em 1 clique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={onQuickUpload}>
            <Plus className="h-3.5 w-3.5" />
            Cadastrar Arquivo
          </Button>
          <Button variant="secondary" size="sm" onClick={onQuickCreateScript}>
            <MessageSquareCode className="h-3.5 w-3.5" />
            Criar Script
          </Button>
          <Button variant="secondary" size="sm" onClick={onQuickCreateTemplate}>
            <Library className="h-3.5 w-3.5" />
            Adicionar Modelo
          </Button>
        </div>
      </div>

      {/* KPIs Executivos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--kz-text-secondary)]">
            <span>Arquivos Cadastrados</span>
            <FolderOpen className="h-4 w-4 text-[var(--kz-accent)]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--kz-text-primary)]">
            {activeFiles.length}
          </p>
          <p className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
            Volume total: {formatFileSize(totalBytes)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--kz-text-secondary)]">
            <span>Scripts Disponíveis</span>
            <MessageSquareCode className="h-4 w-4 text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--kz-text-primary)]">
            {activeScripts.length}
          </p>
          <button
            type="button"
            onClick={() => onNavigateSubTab('scripts')}
            className="mt-1 text-[11px] text-[var(--kz-accent)] hover:underline"
          >
            Abrir Central de Scripts →
          </button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--kz-text-secondary)]">
            <span>Modelos Cadastrados</span>
            <Library className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--kz-text-primary)]">
            {activeTemplates.length}
          </p>
          <button
            type="button"
            onClick={() => onNavigateSubTab('templates')}
            className="mt-1 text-[11px] text-[var(--kz-accent)] hover:underline"
          >
            Explorar Biblioteca →
          </button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--kz-text-secondary)]">
            <span>Vinculados a Clientes</span>
            <Building2 className="h-4 w-4 text-[#D9BC7E]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--kz-text-primary)]">
            {filesLinkedToClients}
          </p>
          <button
            type="button"
            onClick={() => onNavigateSubTab('clients_projects')}
            className="mt-1 text-[11px] text-[var(--kz-accent)] hover:underline"
          >
            Ver por Cliente →
          </button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--kz-text-secondary)]">
            <span>Vinculados a Projetos</span>
            <FolderKanban className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--kz-text-primary)]">
            {filesLinkedToProjects}
          </p>
          <button
            type="button"
            onClick={() => onNavigateSubTab('clients_projects')}
            className="mt-1 text-[11px] text-[var(--kz-accent)] hover:underline"
          >
            Ver por Projeto →
          </button>
        </Card>
      </div>

      {/* Documentos Recentes + Materiais Favoritos + Arquivos por Categoria */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Documentos Recentes */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--kz-text-primary)]">
              Documentos Recentes
            </h4>
            <button
              type="button"
              onClick={() => onNavigateSubTab('files')}
              className="text-xs text-[var(--kz-accent)] hover:underline"
            >
              Ver todos
            </button>
          </div>
          {recentDocs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Nenhum documento cadastrado"
              description="Faça o envio do primeiro arquivo para centralizar materiais da agência."
            />
          ) : (
            <div className="space-y-2.5">
              {recentDocs.map((file) => {
                const effClientId = resolveEffectiveClientIdForFile(
                  file,
                  projects,
                  socialPosts
                );
                const clientObj = effClientId
                  ? clients.find((c) => c.id === effClientId)
                  : null;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onPreviewFile(file)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-[var(--kz-border)] bg-[var(--kz-bg)]/50 px-3 py-2.5 text-left transition hover:border-[var(--kz-accent)]/40 hover:bg-[var(--kz-surface-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--kz-text-primary)]">
                        {file.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--kz-text-muted)]">
                        .{file.extension.toUpperCase()} · {formatFileSize(file.sizeBytes)}
                        {clientObj ? ` · ${clientObj.companyName}` : ''}
                      </p>
                    </div>
                    <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--kz-text-secondary)]" />
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Materiais Favoritos */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--kz-text-primary)]">
              <Star className="h-4 w-4 text-[#D9BC7E]" />
              Materiais Favoritos
            </h4>
            <Badge variant="neutral">
              {favoriteFiles.length + favoriteScripts.length + favoriteTemplates.length}
            </Badge>
          </div>
          {favoriteFiles.length === 0 &&
          favoriteScripts.length === 0 &&
          favoriteTemplates.length === 0 ? (
            <EmptyState
              icon={<Star className="h-5 w-5" />}
              title="Sem favoritos marcados"
              description="Marque arquivos, scripts ou modelos com estrela para acesso rápido."
            />
          ) : (
            <div className="space-y-2.5 text-xs">
              {favoriteFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPreviewFile(f)}
                  className="w-full flex items-center justify-between rounded-lg border border-[var(--kz-border)] bg-[var(--kz-bg)]/50 px-3 py-2 text-left hover:border-[#C6A15B]/50"
                >
                  <span className="truncate font-medium text-[var(--kz-text-primary)]">
                    {f.name}
                  </span>
                  <Badge variant="neutral">Arquivo .{f.extension}</Badge>
                </button>
              ))}
              {favoriteScripts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onNavigateSubTab('scripts')}
                  className="w-full flex items-center justify-between rounded-lg border border-[var(--kz-border)] bg-[var(--kz-bg)]/50 px-3 py-2 text-left hover:border-[#C6A15B]/50"
                >
                  <span className="truncate font-medium text-[var(--kz-text-primary)]">
                    {s.title}
                  </span>
                  <Badge variant="info">Script</Badge>
                </button>
              ))}
              {favoriteTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onNavigateSubTab('templates')}
                  className="w-full flex items-center justify-between rounded-lg border border-[var(--kz-border)] bg-[var(--kz-bg)]/50 px-3 py-2 text-left hover:border-[#C6A15B]/50"
                >
                  <span className="truncate font-medium text-[var(--kz-text-primary)]">
                    {t.title}
                  </span>
                  <Badge variant="success">Modelo</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Arquivos por Categoria */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--kz-text-primary)]">
              Arquivos por Categoria
            </h4>
            <button
              type="button"
              onClick={() => onNavigateSubTab('categories')}
              className="text-xs text-[var(--kz-accent)] hover:underline"
            >
              Gerenciar
            </button>
          </div>
          <div className="space-y-3">
            {categoryBreakdown.map(({ category, count }) => {
              const pct = Math.round((count / maxCatCount) * 100);
              return (
                <div key={category.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-[var(--kz-text-secondary)]">
                      {category.name}
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--kz-text-primary)]">
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--kz-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--kz-accent)]"
                      style={{ width: `${count > 0 ? Math.max(8, pct) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
