import React, { useEffect, useMemo, useState } from 'react';
import {
  Client,
  ProposalContract,
  SocialChannel,
  SocialFormat,
  SocialOwnerType,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
  SOCIAL_FORMAT_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  SOCIAL_POST_STATUS_OPTIONS,
} from '../types/kaizen';
import {
  filterSocialEligibleClients,
  generateSocialPostId,
} from '../services/socialService';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Textarea,
} from './ui';
import { Share2 } from 'lucide-react';

interface SocialPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  proposals: ProposalContract[];
  channels: SocialChannel[];
  userName: string;
  editingPost?: SocialPost | null;
  defaultClientId?: string;
  defaultDate?: string;
  onSavePost: (post: SocialPost, mode: 'create' | 'edit') => Promise<void> | void;
}

export const SocialPostModal: React.FC<SocialPostModalProps> = ({
  isOpen,
  onClose,
  clients,
  proposals,
  channels,
  userName,
  editingPost,
  defaultClientId,
  defaultDate,
  onSavePost,
}) => {
  const [title, setTitle] = useState('');
  const [ownerType, setOwnerType] = useState<SocialOwnerType>('kaizen');
  const [clientId, setClientId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [customPlatformName, setCustomPlatformName] = useState('');
  const [format, setFormat] = useState<SocialFormat>('post');
  const [plannedDate, setPlannedDate] = useState('');
  const [plannedTime, setPlannedTime] = useState('');
  const [caption, setCaption] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assignee, setAssignee] = useState(userName || 'Ian');
  const [status, setStatus] = useState<SocialPostStatus>('ideias');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const eligibleClients = useMemo(
    () => filterSocialEligibleClients(clients, proposals, channels),
    [clients, proposals, channels]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editingPost) {
      setTitle(editingPost.title);
      setOwnerType(editingPost.ownerType);
      setClientId(editingPost.clientId || '');
      setChannelId(editingPost.channelId || '');
      setPlatform(editingPost.platform);
      setCustomPlatformName(editingPost.customPlatformName || '');
      setFormat(editingPost.format);
      setPlannedDate(editingPost.plannedDate || '');
      setPlannedTime(editingPost.plannedTime || '');
      setCaption(editingPost.caption || '');
      setScriptText(editingPost.scriptText || '');
      setAssetUrl(editingPost.assetUrl || '');
      setAssignee(editingPost.assignee || userName || 'Ian');
      setStatus(editingPost.status);
      setNotes(editingPost.notes || '');
    } else {
      setTitle('');
      setOwnerType(defaultClientId ? 'client' : 'kaizen');
      setClientId(defaultClientId || eligibleClients[0]?.id || '');
      setChannelId('');
      setPlatform('instagram');
      setCustomPlatformName('');
      setFormat('post');
      setPlannedDate(defaultDate || '');
      setPlannedTime('18:00');
      setCaption('');
      setScriptText('');
      setAssetUrl('');
      setAssignee(userName || 'Ian');
      setStatus('ideias');
      setNotes('');
    }
  }, [isOpen, editingPost, defaultClientId, defaultDate, userName, eligibleClients.length]);

  const matchingChannels = useMemo(
    () =>
      channels.filter((ch) => {
        if (ch.ownerType !== ownerType) return false;
        if (ownerType === 'client') return ch.clientId === clientId;
        return true;
      }),
    [channels, ownerType, clientId]
  );

  const handleChannelChange = (nextChannelId: string) => {
    setChannelId(nextChannelId);
    const found = channels.find((c) => c.id === nextChannelId);
    if (found) {
      setPlatform(found.platform);
      setCustomPlatformName(found.customPlatformName || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (ownerType === 'client' && !clientId) return;

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      // Never auto-promote to publicado directly inside create/edit modal without explicit confirmation action;
      // if already publicado during edit, keep existing publishedAt metadata.
      const safeStatus: SocialPostStatus =
        editingPost?.status === 'publicado'
          ? status
          : status === 'publicado'
          ? 'aprovado'
          : status;

      const payload: SocialPost = {
        id: editingPost ? editingPost.id : generateSocialPostId(),
        title: title.trim(),
        ownerType,
        clientId: ownerType === 'client' ? clientId : undefined,
        channelId: channelId || undefined,
        platform,
        customPlatformName:
          platform === 'outro' ? customPlatformName.trim() || undefined : undefined,
        format,
        plannedDate: plannedDate || undefined,
        plannedTime: plannedTime || undefined,
        caption: caption.trim() || undefined,
        scriptText: scriptText.trim() || undefined,
        assetUrl: assetUrl.trim() || undefined,
        assignee: assignee.trim() || userName || 'Ian',
        status: safeStatus,
        approvedAt:
          safeStatus === 'aprovado'
            ? editingPost?.approvedAt || nowIso
            : editingPost?.approvedAt,
        publishedAt:
          safeStatus === 'publicado' ? editingPost?.publishedAt : undefined,
        publishedConfirmedBy:
          safeStatus === 'publicado'
            ? editingPost?.publishedConfirmedBy
            : undefined,
        notes: notes.trim() || undefined,
        createdAt: editingPost?.createdAt || nowIso,
        schemaVersion: editingPost?.schemaVersion || 1,
        updatedAt: nowIso,
      };
      await onSavePost(payload, editingPost ? 'edit' : 'create');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      closeDisabled={isSaving}
      title={editingPost ? 'Editar Publicação' : 'Nova Publicação Editorial'}
      subtitle="Organize pauta, roteiro, legenda, formato e aprovação sem publicação automática externa."
      icon={
        <div className="w-9 h-9 rounded-lg bg-[var(--kz-accent-soft)] border border-[var(--kz-accent-border)] flex items-center justify-center text-[var(--kz-accent)]">
          <Share2 className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="kaizen-social-post-form"
            variant="primary"
            loading={isSaving}
            disabled={ownerType === 'client' && !clientId}
          >
            {editingPost ? 'Salvar Alterações' : 'Cadastrar Conteúdo'}
          </Button>
        </>
      }
    >
      <form
        id="kaizen-social-post-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Input
          label="Título / Identificação do Conteúdo *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Carrossel — 5 erros que impedem sua clínica de vender pelo site"
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Marca / Origem *"
            value={ownerType}
            onChange={(e) => {
              setOwnerType(e.target.value as SocialOwnerType);
              setChannelId('');
            }}
          >
            <option value="kaizen">Kaizen (Própria Agência)</option>
            <option value="client">Cliente Elegível</option>
          </Select>

          {ownerType === 'client' ? (
            <Select
              label="Cliente *"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setChannelId('');
              }}
              required
            >
              <option value="">Selecione o cliente...</option>
              {eligibleClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Responsável *"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              required
            />
          )}

          <Select
            label="Canal Cadastrado (opcional)"
            value={channelId}
            onChange={(e) => handleChannelChange(e.target.value)}
          >
            <option value="">Selecionar manualmente abaixo</option>
            {matchingChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.handle} ({ch.platform})
              </option>
            ))}
          </Select>
        </div>

        {ownerType === 'client' && eligibleClients.length === 0 && (
          <Alert variant="warning">
            Nenhum cliente possui gestão de redes sociais ativa no contrato/escopo. Habilite na ficha do cliente antes de programar posts para clientes.
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select
            label="Rede Social *"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
          >
            {SOCIAL_PLATFORM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>

          <Select
            label="Formato *"
            value={format}
            onChange={(e) => setFormat(e.target.value as SocialFormat)}
          >
            {SOCIAL_FORMAT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>

          <Input
            label="Data Planejada"
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
          />

          <Input
            label="Horário"
            type="time"
            value={plannedTime}
            onChange={(e) => setPlannedTime(e.target.value)}
          />

          <Select
            label="Etapa do Fluxo"
            value={status}
            onChange={(e) => setStatus(e.target.value as SocialPostStatus)}
          >
            {SOCIAL_POST_STATUS_OPTIONS.filter(
              (opt) => opt.id !== 'publicado' || editingPost?.status === 'publicado'
            ).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {platform === 'outro' && (
          <Input
            label="Nome da Rede Social *"
            value={customPlatformName}
            onChange={(e) => setCustomPlatformName(e.target.value)}
            placeholder="Ex: YouTube Shorts"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Link do Material / Arte / Drive"
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            placeholder="https://drive.google.com/... ou Canva/Figma"
          />
          {ownerType === 'client' && (
            <Input
              label="Responsável pela Produção *"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              required
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea
            label="Texto / Roteiro / Estrutura de Telas"
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={4}
            placeholder="Gancho inicial, desenvolvimento por slide/cena e CTA..."
          />

          <Textarea
            label="Legenda da Publicação"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Copy final da legenda + hashtags estratégicas..."
          />
        </div>

        <Textarea
          label="Observações / Ajustes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Feedback de revisão, referências visuais ou observações internas..."
        />

        <Alert variant="info">
          Publicações em status <strong>Aprovado</strong> exigem confirmação manual do administrador no painel de Redes Sociais para serem marcadas como <strong>Publicado</strong>.
        </Alert>
      </form>
    </Modal>
  );
};
