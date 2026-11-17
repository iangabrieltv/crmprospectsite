import React, { useEffect, useState } from 'react';
import { Lead, NicheCampaign } from '../../types/crm';
import { Client, Project, ProposalContract, SocialPost, Task } from '../../types/kaizen';
import {
  CommercialScript,
  ModelTemplate,
  ResourceCategory,
  ResourceClientSection,
  ResourceFile,
  ResourceFolder,
  ResourceProjectSection,
} from '../../types/resources';
import {
  archiveResourceFile,
  createResourceFolder,
  hasHistoricalLinks,
  isCloudStorageConfigured,
  purgeResourceFileBinary,
  renameResourceFile,
  restoreResourceFile,
  toggleResourceFileFavorite,
} from '../../services/resources';
import { Alert, ConfirmDialog, Tabs } from '../ui';
import {
  Building2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Library,
  MessageSquareCode,
  Tags,
} from 'lucide-react';
import { ResourcesDashboardTab } from './ResourcesDashboardTab';
import { FilesDocumentsTab } from './FilesDocumentsTab';
import { ClientsProjectsMaterialsTab } from './ClientsProjectsMaterialsTab';
import { CommercialScriptsTab } from './CommercialScriptsTab';
import { ModelLibraryTab } from './ModelLibraryTab';
import { CategoriesOrganizationTab } from './CategoriesOrganizationTab';
import { FileUploadModal } from './FileUploadModal';
import { FilePreviewModal } from './FilePreviewModal';

export type ResourcesSubTabId =
  | 'overview'
  | 'files'
  | 'clients_projects'
  | 'scripts'
  | 'templates'
  | 'categories';

interface ResourcesCenterViewProps {
  initialSubTab?: ResourcesSubTabId;
  files: ResourceFile[];
  folders: ResourceFolder[];
  categories: ResourceCategory[];
  scripts: CommercialScript[];
  templates: ModelTemplate[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  proposals: ProposalContract[];
  socialPosts: SocialPost[];
  leads: Lead[];
  niches: NicheCampaign[];
  userName: string;
  cloudPermissionBlocked?: boolean;
  onSaveFile: (file: ResourceFile, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteFile: (fileId: string) => Promise<void> | void;
  onSaveFolder: (folder: ResourceFolder, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteFolder: (folderId: string) => Promise<void> | void;
  onSaveCategory: (cat: ResourceCategory, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteCategory: (catId: string) => Promise<void> | void;
  onSaveScript: (script: CommercialScript, mode: 'create' | 'edit') => Promise<void> | void;
  onDeleteScript: (scriptId: string) => Promise<void> | void;
  onSaveTemplate: (tmpl: ModelTemplate, mode: 'create' | 'edit') => Promise<void> | void;
  onCreateProposalFromTemplate: (
    draft: Omit<ProposalContract, 'id' | 'createdAt'>
  ) => Promise<void> | void;
  onCreateProjectFromTemplate: (params: {
    project: Project;
    initialTasks: Task[];
  }) => Promise<void> | void;
  onCreateTasksFromTemplate: (tasks: Task[]) => Promise<void> | void;
}

export const ResourcesCenterView: React.FC<ResourcesCenterViewProps> = ({
  initialSubTab = 'overview',
  files,
  folders,
  categories,
  scripts,
  templates,
  clients,
  projects,
  tasks,
  proposals,
  socialPosts,
  leads,
  niches,
  userName,
  cloudPermissionBlocked = false,
  onSaveFile,
  onDeleteFile,
  onSaveFolder,
  onDeleteFolder,
  onSaveCategory,
  onDeleteCategory,
  onSaveScript,
  onDeleteScript,
  onSaveTemplate,
  onCreateProposalFromTemplate,
  onCreateProjectFromTemplate,
  onCreateTasksFromTemplate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ResourcesSubTabId>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Modais globais de arquivo
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<ResourceFile | null>(null);
  const [uploadDefaults, setUploadDefaults] = useState<{
    folderId?: string;
    clientId?: string;
    projectId?: string;
    clientSection?: ResourceClientSection;
    projectSection?: ResourceProjectSection;
  }>({});

  const [previewingFile, setPreviewingFile] = useState<ResourceFile | null>(null);
  const [deleteTargetFile, setDeleteTargetFile] = useState<ResourceFile | null>(null);

  const cloudConfigured = isCloudStorageConfigured();
  const hasDevLocalFiles = files.some((f) => f.storageProvider === 'indexeddb_dev');

  const handleOpenNewUpload = (defaults: typeof uploadDefaults = {}) => {
    setEditingFile(null);
    setUploadDefaults(defaults);
    setUploadOpen(true);
  };

  const handleToggleFileFavorite = async (file: ResourceFile) => {
    const updated = toggleResourceFileFavorite(file);
    await onSaveFile(updated, 'edit');
    if (previewingFile?.id === file.id) {
      setPreviewingFile(updated);
    }
  };

  const handleRenameFile = async (file: ResourceFile, nextName: string) => {
    const updated = renameResourceFile(file, nextName);
    await onSaveFile(updated, 'edit');
    if (previewingFile?.id === file.id) {
      setPreviewingFile(updated);
    }
  };

  const handleArchiveToggleFile = async (file: ResourceFile) => {
    const updated =
      file.status === 'arquivado'
        ? restoreResourceFile(file)
        : archiveResourceFile(file);
    await onSaveFile(updated, 'edit');
    if (previewingFile?.id === file.id) {
      setPreviewingFile(updated);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!deleteTargetFile) return;
    if (hasHistoricalLinks(deleteTargetFile) && deleteTargetFile.status !== 'arquivado') {
      await onSaveFile(archiveResourceFile(deleteTargetFile), 'edit');
      setDeleteTargetFile(null);
      setPreviewingFile(null);
      return;
    }
    await purgeResourceFileBinary(deleteTargetFile);
    await onDeleteFile(deleteTargetFile.id);
    setDeleteTargetFile(null);
    setPreviewingFile(null);
  };

  const tabItems = [
    {
      id: 'overview' as const,
      label: 'Visão Geral',
      icon: <LayoutDashboard className="h-3.5 w-3.5" />,
    },
    {
      id: 'files' as const,
      label: 'Arquivos e Documentos',
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      badge: files.filter((f) => f.status === 'ativo').length,
    },
    {
      id: 'clients_projects' as const,
      label: 'Clientes e Projetos',
      icon: <Building2 className="h-3.5 w-3.5" />,
    },
    {
      id: 'scripts' as const,
      label: 'Scripts',
      icon: <MessageSquareCode className="h-3.5 w-3.5" />,
      badge: scripts.filter((s) => s.status === 'ativo').length,
    },
    {
      id: 'templates' as const,
      label: 'Biblioteca de Modelos',
      icon: <Library className="h-3.5 w-3.5" />,
      badge: templates.filter((t) => t.status === 'ativo').length,
    },
    {
      id: 'categories' as const,
      label: 'Categorias e Organização',
      icon: <Tags className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">
            Central de Materiais, Documentos, Scripts e Modelos
          </h2>
          <p className="kz-subtitle">
            Acervo organizado de documentos da agência, materiais de clientes e projetos, scripts comerciais e modelos reutilizáveis.
          </p>
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert
          variant="warning"
          title="Sincronização em nuvem pendente de atualização das regras do Firestore"
        >
          O arquivo local <code className="font-mono">firestore.rules</code> já contempla as coleções da Etapa 5, mas como a publicação remota permanece bloqueada nesta etapa, os registros ficam persistidos localmente neste navegador até você publicar as regras no Firebase Console.
        </Alert>
      )}

      {/* Navegação das 6 áreas da Central */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={tabItems}
          activeId={activeSubTab}
          onChange={setActiveSubTab}
          variant="underline"
        />
      </div>

      {(!cloudConfigured || hasDevLocalFiles) && (
        <Alert
          variant="info"
          title="Armazenamento em Modo Desenvolvimento (Sem Publicação Remota de Regras)"
        >
          Os metadados e vínculos estão sincronizados no Firestore, enquanto os binários
          enviados neste ambiente são protegidos no cofre local do navegador (IndexedDB)
          sem gravar payloads pesados no banco e mantendo <code className="font-mono">storage.rules</code> privada localmente até autorização de publicação.
        </Alert>
      )}

      {activeSubTab === 'overview' && (
        <ResourcesDashboardTab
          files={files}
          categories={categories}
          scripts={scripts}
          templates={templates}
          clients={clients}
          projects={projects}
          socialPosts={socialPosts}
          onQuickUpload={() => handleOpenNewUpload()}
          onQuickCreateScript={() => setActiveSubTab('scripts')}
          onQuickCreateTemplate={() => setActiveSubTab('templates')}
          onPreviewFile={setPreviewingFile}
          onNavigateSubTab={setActiveSubTab}
        />
      )}

      {activeSubTab === 'files' && (
        <FilesDocumentsTab
          files={files}
          folders={folders}
          categories={categories}
          clients={clients}
          projects={projects}
          socialPosts={socialPosts}
          onOpenUpload={(folderId) => handleOpenNewUpload({ folderId })}
          onCreateFolder={async (name, parentId) => {
            const folder = createResourceFolder({ name, parentId });
            await onSaveFolder(folder, 'create');
          }}
          onPreviewFile={setPreviewingFile}
          onEditFile={(file) => {
            setEditingFile(file);
            setUploadOpen(true);
          }}
          onToggleFavorite={handleToggleFileFavorite}
          onArchiveToggle={handleArchiveToggleFile}
          onDeleteRequest={setDeleteTargetFile}
        />
      )}

      {activeSubTab === 'clients_projects' && (
        <ClientsProjectsMaterialsTab
          files={files}
          clients={clients}
          projects={projects}
          tasks={tasks}
          socialPosts={socialPosts}
          onPreviewFile={setPreviewingFile}
          onUploadForClient={(clientId, clientSection) =>
            handleOpenNewUpload({ clientId, clientSection })
          }
          onUploadForProject={(projectId, projectSection) => {
            const proj = projects.find((p) => p.id === projectId);
            handleOpenNewUpload({
              projectId,
              clientId: proj?.clientId,
              projectSection,
            });
          }}
        />
      )}

      {activeSubTab === 'scripts' && (
        <CommercialScriptsTab
          scripts={scripts}
          categories={categories}
          leads={leads}
          niches={niches}
          clients={clients}
          userName={userName}
          onSaveScript={onSaveScript}
          onDeleteScript={onDeleteScript}
        />
      )}

      {activeSubTab === 'templates' && (
        <ModelLibraryTab
          templates={templates}
          categories={categories}
          clients={clients}
          leads={leads}
          niches={niches}
          projects={projects}
          proposals={proposals}
          userName={userName}
          onSaveTemplate={onSaveTemplate}
          onCreateProposalFromTemplate={onCreateProposalFromTemplate}
          onCreateProjectFromTemplate={onCreateProjectFromTemplate}
          onCreateTasksFromTemplate={onCreateTasksFromTemplate}
        />
      )}

      {activeSubTab === 'categories' && (
        <CategoriesOrganizationTab
          categories={categories}
          folders={folders}
          files={files}
          scripts={scripts}
          templates={templates}
          onSaveCategory={onSaveCategory}
          onDeleteCategory={onDeleteCategory}
          onSaveFolder={onSaveFolder}
          onDeleteFolder={onDeleteFolder}
        />
      )}

      {/* Modal de Upload / Edição de Arquivo */}
      <FileUploadModal
        isOpen={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setEditingFile(null);
        }}
        categories={categories}
        folders={folders}
        clients={clients}
        projects={projects}
        userName={userName}
        editingFile={editingFile}
        defaultFolderId={uploadDefaults.folderId}
        defaultClientId={uploadDefaults.clientId}
        defaultProjectId={uploadDefaults.projectId}
        defaultClientSection={uploadDefaults.clientSection}
        defaultProjectSection={uploadDefaults.projectSection}
        onSaveFile={onSaveFile}
      />

      {/* Modal de Pré-Visualização e Informações do Arquivo */}
      <FilePreviewModal
        file={previewingFile}
        onClose={() => setPreviewingFile(null)}
        categories={categories}
        folders={folders}
        clients={clients}
        projects={projects}
        tasks={tasks}
        socialPosts={socialPosts}
        onEditMetadata={(file) => {
          setEditingFile(file);
          setUploadOpen(true);
        }}
        onRenameFile={handleRenameFile}
        onToggleFavorite={handleToggleFileFavorite}
        onArchiveToggle={handleArchiveToggleFile}
        onDeleteRequest={setDeleteTargetFile}
      />

      {/* Diálogo Seguro de Exclusão/Arquivamento de Arquivo */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetFile)}
        onClose={() => setDeleteTargetFile(null)}
        onConfirm={handleConfirmDeleteFile}
        title={
          deleteTargetFile &&
          hasHistoricalLinks(deleteTargetFile) &&
          deleteTargetFile.status !== 'arquivado'
            ? 'Arquivar Material Vinculado'
            : 'Excluir Arquivo Permanentemente'
        }
        description={
          deleteTargetFile &&
          hasHistoricalLinks(deleteTargetFile) &&
          deleteTargetFile.status !== 'arquivado' ? (
            <div className="space-y-2">
              <p>
                O arquivo <strong>{deleteTargetFile.name}</strong> está vinculado a clientes,
                projetos, tarefas ou publicações.
              </p>
              <p>
                Por segurança de histórico, ele será movido para <strong>Arquivados</strong>.
                Se desejar removê-lo definitivamente após arquivar, você poderá excluí-lo da aba
                Arquivados.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Deseja excluir definitivamente <strong>{deleteTargetFile?.name}</strong>? Esta
                ação remove os metadados e o conteúdo armazenado.
              </span>
            </div>
          )
        }
        confirmLabel={
          deleteTargetFile &&
          hasHistoricalLinks(deleteTargetFile) &&
          deleteTargetFile.status !== 'arquivado'
            ? 'Arquivar com Segurança'
            : 'Excluir Definitivamente'
        }
      />
    </div>
  );
};
