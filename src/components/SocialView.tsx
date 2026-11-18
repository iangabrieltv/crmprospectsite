import React, { useMemo, useState } from 'react';
import {
  Client,
  ProposalContract,
  SocialChannel,
  SocialOwnerType,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
  SOCIAL_PLATFORM_OPTIONS,
  SOCIAL_POST_STATUS_OPTIONS,
  getSocialFormatLabel,
  getSocialPlatformLabel,
  getSocialPostStatusMeta,
} from '../types/kaizen';
import {
  confirmSocialPostPublished,
  filterSocialEligibleClients,
  transitionSocialPostStage,
} from '../services/socialService';
import { getTodayIsoDate } from '../services/projectService';
import { getFilesForSocialPostContext } from '../services/resources';
import {
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from '../types/resources';
import { SocialChannelModal } from './SocialChannelModal';
import { SocialPostModal } from './SocialPostModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from './ui';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Kanban,
  List,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';

interface SocialViewProps {
  channels: SocialChannel[];
  posts: SocialPost[];
  clients: Client[];
  proposals: ProposalContract[];
  resourceFiles?: ResourceFile[];
  resourceCategories?: ResourceCategory[];
  resourceFolders?: ResourceFolder[];
  userName: string;
  cloudPermissionBlocked?: boolean;
  onSaveChannel: (
    channel: SocialChannel,
    mode: 'create' | 'edit'
  ) => Promise<void> | void;
  onDeleteChannel: (channelId: string) => Promise<void> | void;
  onSavePost: (post: SocialPost, mode: 'create' | 'edit') => Promise<void> | void;
  onDeletePost: (postId: string) => Promise<void> | void;
  onSyncSocialPostFiles?: (
    postId: string,
    clientId: string,
    selectedFileIds: string[]
  ) => Promise<void> | void;
  onOpenClient?: (clientId: string) => void;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const SocialView: React.FC<SocialViewProps> = ({
  channels,
  posts,
  clients,
  proposals,
  resourceFiles = [],
  userName,
  cloudPermissionBlocked = false,
  onSaveChannel,
  onDeleteChannel,
  onSavePost,
  onDeletePost,
  onSyncSocialPostFiles,
  onOpenClient,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'list' | 'channels'>(
    'kanban'
  );
  const [ownerFilter, setOwnerFilter] = useState<'all' | SocialOwnerType>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SocialChannel | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<SocialChannel | null>(null);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [defaultPostDate, setDefaultPostDate] = useState<string | undefined>(undefined);
  const [postToConfirmPublish, setPostToConfirmPublish] = useState<SocialPost | null>(
    null
  );
  const [postToDelete, setPostToDelete] = useState<SocialPost | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const todayStr = getTodayIsoDate();
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  const eligibleClients = useMemo(
    () => filterSocialEligibleClients(clients, proposals, channels),
    [clients, proposals, channels]
  );

  const filteredPosts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return posts.filter((post) => {
      if (ownerFilter !== 'all' && post.ownerType !== ownerFilter) return false;
      if (clientFilter !== 'all' && post.clientId !== clientFilter) return false;
      if (platformFilter !== 'all' && post.platform !== platformFilter) return false;
      if (q) {
        const ownerName =
          post.ownerType === 'kaizen'
            ? 'Kaizen'
            : clientById.get(post.clientId || '')?.companyName || '';
        const haystack = [
          post.title,
          post.caption || '',
          post.scriptText || '',
          ownerName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [posts, ownerFilter, clientFilter, platformFilter, searchTerm, clientById]);

  const counts = useMemo(() => {
    const approvedPendingPublish = posts.filter((p) => p.status === 'aprovado').length;
    const inProduction = posts.filter(
      (p) =>
        p.status === 'ideias' ||
        p.status === 'planejamento' ||
        p.status === 'producao' ||
        p.status === 'revisao'
    ).length;
    const published = posts.filter((p) => p.status === 'publicado').length;
    return {
      totalPosts: posts.length,
      inProduction,
      approvedPendingPublish,
      published,
      channelsCount: channels.length,
    };
  }, [posts, channels]);

  // Monthly Editorial Calendar Grid
  const monthGridDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateStr: string; dayNumber: number; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      cells.push({ dateStr: `${y}-${m}-${day}`, dayNumber: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(month + 1).padStart(2, '0');
      const day = String(d).padStart(2, '0');
      cells.push({
        dateStr: `${year}-${m}-${day}`,
        dayNumber: d,
        inMonth: true,
      });
    }
    while (cells.length % 7 !== 0) {
      const nextIndex = cells.length - (startOffset + daysInMonth) + 1;
      const d = new Date(year, month + 1, nextIndex);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      cells.push({ dateStr: `${y}-${m}-${day}`, dayNumber: d.getDate(), inMonth: false });
    }
    return cells;
  }, [calendarDate]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const p of filteredPosts) {
      if (!p.plannedDate) continue;
      const arr = map.get(p.plannedDate) || [];
      arr.push(p);
      map.set(p.plannedDate, arr);
    }
    return map;
  }, [filteredPosts]);

  const handleStageSelectChange = async (
    post: SocialPost,
    nextStatus: SocialPostStatus
  ) => {
    if (nextStatus === post.status) return;
    if (nextStatus === 'publicado') {
      // NEVER auto-promote without explicit confirmation dialog
      setPostToConfirmPublish(post);
      return;
    }
    const updated = transitionSocialPostStage(post, nextStatus);
    await onSavePost(updated, 'edit');
  };

  const handleConfirmManualPublish = async () => {
    if (!postToConfirmPublish) return;
    setIsProcessing(true);
    try {
      const published = confirmSocialPostPublished(
        postToConfirmPublish,
        userName || 'Ian'
      );
      await onSavePost(published, 'edit');
      setPostToConfirmPublish(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;
    setIsProcessing(true);
    try {
      await onDeletePost(postToDelete.id);
      setPostToDelete(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDeleteChannel = async () => {
    if (!channelToDelete) return;
    setIsProcessing(true);
    try {
      await onDeleteChannel(channelToDelete.id);
      setChannelToDelete(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatBrDate = (iso?: string) =>
    iso ? iso.split('-').reverse().join('/') : 'Sem data';

  const getOwnerBadgeLabel = (post: { ownerType: SocialOwnerType; clientId?: string }) =>
    post.ownerType === 'kaizen'
      ? 'Kaizen'
      : clientById.get(post.clientId || '')?.companyName || 'Cliente';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div>
          <h2 className="kz-page-title">Redes Sociais & Calendário Editorial</h2>
          <p className="kz-subtitle mt-1">
            Gerencie canais da Kaizen e dos clientes com gestão contratada, pautas, produção e publicação confirmada manualmente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<Share2 className="w-4 h-4" />}
            onClick={() => {
              setEditingChannel(null);
              setIsChannelModalOpen(true);
            }}
          >
            Novo Canal
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingPost(null);
              setDefaultPostDate(undefined);
              setIsPostModalOpen(true);
            }}
          >
            Nova Publicação
          </Button>
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert variant="warning">
          Os dados de Redes Sociais estão sendo salvos localmente neste navegador enquanto as coleções{' '}
          <code className="font-mono">socialChannels</code> e{' '}
          <code className="font-mono">socialPosts</code> aguardam publicação do{' '}
          <code className="font-mono">firestore.rules</code> atualizado.
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
            Em Produção / Revisão
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {counts.inProduction}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            Ideias, planejamento e revisão
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-accent-text)]">
            Aprovados (Aguardando Publicar)
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-accent-text)]">
            {counts.approvedPendingPublish}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            Requer confirmação manual
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-success-text)]">
            Publicados Confirmados
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-success-text)]">
            {counts.published}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            Confirmados pelo administrador
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-medium text-[var(--kz-text-muted)]">
            Canais Ativos / Clientes Elegíveis
          </div>
          <div className="mt-1.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {counts.channelsCount}
          </div>
          <div className="text-[11px] text-[var(--kz-text-muted)]">
            {eligibleClients.length} cliente(s) com escopo social
          </div>
        </Card>
      </div>

      {/* View Switcher & Filters */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <Tabs
            activeId={viewMode}
            onChange={(id) =>
              setViewMode(id as 'calendar' | 'kanban' | 'list' | 'channels')
            }
            items={[
              { id: 'kanban', label: 'Quadro Kanban', icon: <Kanban className="w-3.5 h-3.5" /> },
              {
                id: 'calendar',
                label: 'Calendário Editorial',
                icon: <Calendar className="w-3.5 h-3.5" />,
              },
              {
                id: 'list',
                label: 'Lista de Publicações',
                badge: filteredPosts.length,
                icon: <List className="w-3.5 h-3.5" />,
              },
              {
                id: 'channels',
                label: 'Canais Cadastrados',
                badge: channels.length,
                icon: <Share2 className="w-3.5 h-3.5" />,
              },
            ]}
          />
        </div>

        {viewMode !== 'channels' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar título, legenda ou roteiro..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />

            <Select
              value={ownerFilter}
              onChange={(e) =>
                setOwnerFilter(e.target.value as 'all' | SocialOwnerType)
              }
            >
              <option value="all">Kaizen + Clientes</option>
              <option value="kaizen">Somente Kaizen</option>
              <option value="client">Somente Clientes</option>
            </Select>

            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">Todos os Clientes Elegíveis</option>
              {eligibleClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>

            <Select
              value={platformFilter}
              onChange={(e) =>
                setPlatformFilter(e.target.value as SocialPlatform | 'all')
              }
            >
              <option value="all">Todas as Redes</option>
              {SOCIAL_PLATFORM_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      {/* Channels Tab */}
      {viewMode === 'channels' && (
        <div className="space-y-4">
          {channels.length === 0 ? (
            <EmptyState
              icon={<Share2 className="w-6 h-6" />}
              title="Nenhum canal social cadastrado"
              description="Cadastre os perfis oficiais da Kaizen ou dos clientes que contrataram gestão de redes sociais."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingChannel(null);
                    setIsChannelModalOpen(true);
                  }}
                >
                  Cadastrar Canal
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {channels.map((ch) => (
                <Card key={ch.id} padding="md" className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <Badge
                          variant={ch.ownerType === 'kaizen' ? 'accent' : 'info'}
                          size="sm"
                        >
                          {getOwnerBadgeLabel(ch)}
                        </Badge>
                        <Badge variant={ch.active ? 'success' : 'neutral'} size="sm" dot>
                          {ch.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold text-[var(--kz-text-primary)] truncate">
                        {ch.handle}
                      </h3>
                      <p className="text-xs text-[var(--kz-text-muted)]">
                        {getSocialPlatformLabel(ch.platform, ch.customPlatformName)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingChannel(ch);
                          setIsChannelModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[var(--kz-text-muted)] hover:text-[var(--kz-accent-text)] cursor-pointer"
                        title="Editar canal"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannelToDelete(ch)}
                        className="p-1.5 rounded-lg text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] cursor-pointer"
                        title="Remover canal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {ch.notes && (
                    <p className="text-xs text-[var(--kz-text-secondary)] line-clamp-2">
                      {ch.notes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-[var(--kz-border-subtle)] flex items-center justify-between text-xs">
                    {ch.profileUrl ? (
                      <a
                        href={
                          ch.profileUrl.startsWith('http')
                            ? ch.profileUrl
                            : `https://${ch.profileUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--kz-accent-text)] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir Perfil</span>
                      </a>
                    ) : (
                      <span className="text-[var(--kz-text-subtle)]">Sem URL externa</span>
                    )}

                    {ch.ownerType === 'client' && ch.clientId && onOpenClient && (
                      <button
                        type="button"
                        onClick={() => onOpenClient(ch.clientId!)}
                        className="text-[var(--kz-text-secondary)] hover:text-[var(--kz-text-primary)] underline cursor-pointer"
                      >
                        Ver Cliente
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kanban Pipeline */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-start">
          {SOCIAL_POST_STATUS_OPTIONS.map((stage) => {
            const stagePosts = filteredPosts.filter((p) => p.status === stage.id);
            return (
              <div
                key={stage.id}
                className="rounded-xl bg-[var(--kz-bg-subtle)]/50 border border-[var(--kz-border-subtle)] p-2.5 space-y-2.5 min-h-[340px]"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--kz-border-subtle)]">
                  <Badge variant={stage.variant} size="sm" dot>
                    {stage.label}
                  </Badge>
                  <span className="text-[11px] font-mono font-bold text-[var(--kz-text-muted)]">
                    {stagePosts.length}
                  </span>
                </div>

                {stagePosts.length === 0 ? (
                  <div className="py-6 text-center text-[11px] text-[var(--kz-text-subtle)] border border-dashed border-[var(--kz-border-subtle)] rounded-lg">
                    Vazio
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stagePosts.map((post) => (
                      <div
                        key={post.id}
                        className="p-2.5 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-subtle)] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-semibold text-[var(--kz-text-primary)] leading-snug">
                            {post.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPost(post);
                              setIsPostModalOpen(true);
                            }}
                            className="p-1 text-[var(--kz-text-subtle)] hover:text-[var(--kz-accent-text)] cursor-pointer shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant={post.ownerType === 'kaizen' ? 'accent' : 'info'}
                            size="sm"
                          >
                            {getOwnerBadgeLabel(post)}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {getSocialPlatformLabel(post.platform, post.customPlatformName)} ·{' '}
                            {getSocialFormatLabel(post.format)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--kz-text-muted)]">
                          <span>
                            {post.plannedDate
                              ? `${formatBrDate(post.plannedDate)}${
                                  post.plannedTime ? ` · ${post.plannedTime}` : ''
                                }`
                              : 'Sem data definida'}
                          </span>
                          {getFilesForSocialPostContext(resourceFiles, post.id).length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[var(--kz-accent-text)]">
                              <Paperclip className="w-2.5 h-2.5" />
                              {getFilesForSocialPostContext(resourceFiles, post.id).length}
                            </span>
                          )}
                        </div>

                        {post.status === 'aprovado' && (
                          <Button
                            variant="primary"
                            size="xs"
                            className="w-full"
                            leftIcon={<Send className="w-3 h-3" />}
                            onClick={() => setPostToConfirmPublish(post)}
                          >
                            Confirmar Publicação
                          </Button>
                        )}

                        {post.status !== 'publicado' && (
                          <Select
                            value={post.status}
                            onChange={(e) =>
                              handleStageSelectChange(
                                post,
                                e.target.value as SocialPostStatus
                              )
                            }
                            className="h-7 text-[11px]"
                          >
                            {SOCIAL_POST_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.id === 'publicado'
                                  ? 'Confirmar Publicado...'
                                  : opt.label}
                              </option>
                            ))}
                          </Select>
                        )}

                        {post.status === 'publicado' && post.publishedAt && (
                          <div className="text-[10px] text-[var(--kz-success-text)] flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>
                              Publicado por {post.publishedConfirmedBy || 'Admin'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editorial Calendar */}
      {viewMode === 'calendar' && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--kz-text-primary)] capitalize">
              {calendarDate.toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() =>
                  setCalendarDate(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCalendarDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() =>
                  setCalendarDate(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-bold uppercase text-[var(--kz-text-muted)] py-1"
              >
                {day}
              </div>
            ))}

            {monthGridDays.map((cell) => {
              const dayPosts = postsByDate.get(cell.dateStr) || [];
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={cell.dateStr}
                  className={`min-h-[108px] p-1.5 rounded-lg border flex flex-col gap-1 ${
                    isToday
                      ? 'border-[var(--kz-accent)] bg-[var(--kz-accent-soft)]/30'
                      : cell.inMonth
                      ? 'border-[var(--kz-border-subtle)] bg-[var(--kz-bg-surface)]'
                      : 'border-[var(--kz-border-subtle)]/40 bg-[var(--kz-bg-canvas)]/50 opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        isToday
                          ? 'text-[var(--kz-accent-text)]'
                          : 'text-[var(--kz-text-muted)]'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPost(null);
                        setDefaultPostDate(cell.dateStr);
                        setIsPostModalOpen(true);
                      }}
                      className="p-0.5 text-[var(--kz-text-subtle)] hover:text-[var(--kz-accent-text)] cursor-pointer"
                      title="Agendar publicação nesta data"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-20">
                    {dayPosts.map((p) => {
                      const sMeta = getSocialPostStatusMeta(p.status);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setEditingPost(p);
                            setIsPostModalOpen(true);
                          }}
                          className="w-full text-left px-1.5 py-1 rounded bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] border border-[var(--kz-border-subtle)] text-[10px] leading-tight cursor-pointer"
                        >
                          <div className="font-semibold text-[var(--kz-text-primary)] truncate">
                            {p.title}
                          </div>
                          <div className="text-[9px] text-[var(--kz-text-muted)] truncate">
                            {getOwnerBadgeLabel(p)} · {sMeta.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        filteredPosts.length === 0 ? (
          <EmptyState
            icon={<Share2 className="w-6 h-6" />}
            title="Nenhuma publicação encontrada"
            description="Cadastre sua primeira pauta editorial para a Kaizen ou para um cliente com gestão contratada."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditingPost(null);
                  setIsPostModalOpen(true);
                }}
              >
                Nova Publicação
              </Button>
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Publicação</TableHead>
                  <TableHead>Marca / Cliente</TableHead>
                  <TableHead>Rede / Formato</TableHead>
                  <TableHead>Data Planejada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => {
                  const stMeta = getSocialPostStatusMeta(post.status);
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="font-semibold text-[var(--kz-text-primary)]">
                        <div>{post.title}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-normal text-[var(--kz-text-muted)]">
                          <span>Responsável: {post.assignee}</span>
                          {getFilesForSocialPostContext(resourceFiles, post.id).length > 0 && (
                            <span className="inline-flex items-center gap-1 font-mono text-[var(--kz-accent-text)]">
                              <Paperclip className="w-3 h-3" />
                              {getFilesForSocialPostContext(resourceFiles, post.id).length}{' '}
                              material(is)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={post.ownerType === 'kaizen' ? 'accent' : 'info'}
                          size="sm"
                        >
                          {getOwnerBadgeLabel(post)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--kz-text-secondary)]">
                        {getSocialPlatformLabel(post.platform, post.customPlatformName)} ·{' '}
                        {getSocialFormatLabel(post.format)}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {formatBrDate(post.plannedDate)}
                        {post.plannedTime ? ` ${post.plannedTime}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stMeta.variant} size="sm" dot>
                          {stMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {post.status === 'aprovado' && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => setPostToConfirmPublish(post)}
                            >
                              Publicar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setEditingPost(post);
                              setIsPostModalOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <button
                            type="button"
                            onClick={() => setPostToDelete(post)}
                            className="p-1.5 text-[var(--kz-text-subtle)] hover:text-[var(--kz-danger-text)] cursor-pointer"
                            aria-label="Excluir publicação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

      <SocialChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => {
          setIsChannelModalOpen(false);
          setEditingChannel(null);
        }}
        clients={clients}
        proposals={proposals}
        existingChannels={channels}
        editingChannel={editingChannel}
        onSaveChannel={onSaveChannel}
      />

      <SocialPostModal
        isOpen={isPostModalOpen}
        onClose={() => {
          setIsPostModalOpen(false);
          setEditingPost(null);
          setDefaultPostDate(undefined);
        }}
        clients={clients}
        proposals={proposals}
        channels={channels}
        resourceFiles={resourceFiles}
        userName={userName}
        editingPost={editingPost}
        defaultDate={defaultPostDate}
        onSavePost={onSavePost}
        onSyncSocialPostFiles={onSyncSocialPostFiles}
      />

      <ConfirmDialog
        isOpen={Boolean(postToConfirmPublish)}
        onClose={() => setPostToConfirmPublish(null)}
        onConfirm={handleConfirmManualPublish}
        title="Confirmar Publicação Realizada"
        description={
          postToConfirmPublish ? (
            <span>
              Confirma que o conteúdo <strong>{postToConfirmPublish.title}</strong> já foi publicado manualmente na rede social{' '}
              <strong>
                {getSocialPlatformLabel(
                  postToConfirmPublish.platform,
                  postToConfirmPublish.customPlatformName
                )}
              </strong>
              ?
            </span>
          ) : (
            ''
          )
        }
        confirmLabel="Confirmar Publicação"
        variant="primary"
        loading={isProcessing}
      />

      <ConfirmDialog
        isOpen={Boolean(postToDelete)}
        onClose={() => setPostToDelete(null)}
        onConfirm={handleConfirmDeletePost}
        title="Excluir Publicação"
        description={
          <span>
            Deseja remover <strong>{postToDelete?.title}</strong> do calendário editorial?
          </span>
        }
        confirmLabel="Confirmar Exclusão"
        variant="danger"
        loading={isProcessing}
      />

      <ConfirmDialog
        isOpen={Boolean(channelToDelete)}
        onClose={() => setChannelToDelete(null)}
        onConfirm={handleConfirmDeleteChannel}
        title="Remover Canal Social"
        description={
          <span>
            Deseja remover o canal <strong>{channelToDelete?.handle}</strong>? As publicações cadastradas serão preservadas.
          </span>
        }
        confirmLabel="Confirmar Remoção"
        variant="danger"
        loading={isProcessing}
      />
    </div>
  );
};
