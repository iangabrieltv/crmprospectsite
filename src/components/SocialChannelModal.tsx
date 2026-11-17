import React, { useEffect, useState } from 'react';
import {
  Client,
  ProposalContract,
  SocialChannel,
  SocialOwnerType,
  SocialPlatform,
  SOCIAL_PLATFORM_OPTIONS,
} from '../types/kaizen';
import {
  filterSocialEligibleClients,
  generateSocialChannelId,
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

interface SocialChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  proposals: ProposalContract[];
  existingChannels: SocialChannel[];
  editingChannel?: SocialChannel | null;
  onSaveChannel: (
    channel: SocialChannel,
    mode: 'create' | 'edit'
  ) => Promise<void> | void;
}

export const SocialChannelModal: React.FC<SocialChannelModalProps> = ({
  isOpen,
  onClose,
  clients,
  proposals,
  existingChannels,
  editingChannel,
  onSaveChannel,
}) => {
  const [ownerType, setOwnerType] = useState<SocialOwnerType>('kaizen');
  const [clientId, setClientId] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [customPlatformName, setCustomPlatformName] = useState('');
  const [handle, setHandle] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const eligibleClients = filterSocialEligibleClients(
    clients,
    proposals,
    existingChannels
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editingChannel) {
      setOwnerType(editingChannel.ownerType);
      setClientId(editingChannel.clientId || '');
      setPlatform(editingChannel.platform);
      setCustomPlatformName(editingChannel.customPlatformName || '');
      setHandle(editingChannel.handle);
      setProfileUrl(editingChannel.profileUrl || '');
      setActive(editingChannel.active);
      setNotes(editingChannel.notes || '');
    } else {
      setOwnerType('kaizen');
      setClientId(eligibleClients[0]?.id || '');
      setPlatform('instagram');
      setCustomPlatformName('');
      setHandle('');
      setProfileUrl('');
      setActive(true);
      setNotes('');
    }
  }, [isOpen, editingChannel, eligibleClients.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    if (ownerType === 'client' && !clientId) return;

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: SocialChannel = {
        id: editingChannel ? editingChannel.id : generateSocialChannelId(),
        ownerType,
        clientId: ownerType === 'client' ? clientId : undefined,
        platform,
        customPlatformName:
          platform === 'outro' ? customPlatformName.trim() || undefined : undefined,
        handle: handle.trim(),
        profileUrl: profileUrl.trim() || undefined,
        active,
        notes: notes.trim() || undefined,
        createdAt: editingChannel?.createdAt || nowIso,
        schemaVersion: editingChannel?.schemaVersion || 1,
        updatedAt: nowIso,
      };
      await onSaveChannel(payload, editingChannel ? 'edit' : 'create');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      closeDisabled={isSaving}
      title={editingChannel ? 'Editar Canal Social' : 'Cadastrar Canal Social'}
      subtitle="Vincule canais próprios da Kaizen ou de clientes que possuam gestão de redes sociais contratada."
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
            form="kaizen-social-channel-form"
            variant="primary"
            loading={isSaving}
            disabled={ownerType === 'client' && !clientId}
          >
            {editingChannel ? 'Salvar Canal' : 'Cadastrar Canal'}
          </Button>
        </>
      }
    >
      <form
        id="kaizen-social-channel-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Propriedade do Canal *"
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value as SocialOwnerType)}
          >
            <option value="kaizen">Kaizen (Agência)</option>
            <option value="client">Cliente com serviço contratado</option>
          </Select>

          <Select
            label="Plataforma *"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
          >
            {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {ownerType === 'client' && (
          eligibleClients.length === 0 ? (
            <Alert variant="warning">
              Nenhum cliente possui escopo de Redes Sociais identificado ou habilitado. Ative a opção{' '}
              <strong>Gestão de Redes Sociais</strong> na ficha do cliente para vincular canais.
            </Alert>
          ) : (
            <Select
              label="Cliente Contratante *"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Selecione o cliente...</option>
              {eligibleClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          )
        )}

        {platform === 'outro' && (
          <Input
            label="Nome da Plataforma *"
            value={customPlatformName}
            onChange={(e) => setCustomPlatformName(e.target.value)}
            placeholder="Ex: YouTube, Pinterest, Threads..."
            required
          />
        )}

        <Input
          label="Arroba / Identificador (@handle) *"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Ex: @kaizen.agencia"
          required
        />

        <Input
          label="URL do Perfil (opcional)"
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://instagram.com/..."
        />

        <label className="flex items-center gap-2 text-xs text-[var(--kz-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded accent-[var(--kz-accent)]"
          />
          <span>Canal ativo no calendário editorial</span>
        </label>

        <Textarea
          label="Observações do Canal"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Linha editorial, tom de voz ou frequência semanal..."
        />
      </form>
    </Modal>
  );
};
