import React, { useState } from 'react';
import { Lead, FunnelStageId, FUNNEL_STAGES, NicheCampaign, ScriptId } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { Star } from 'lucide-react';
import { Modal, Input, Select, Button } from './ui';

interface NewLeadModalProps {
  niche: NicheCampaign;
  defaultStage?: FunnelStageId;
  onClose: () => void;
  onCreateLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'notes'>) => void;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  niche,
  defaultStage = 'leads_sem_contato',
  onClose,
  onCreateLead,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState(niche.city);
  const [address, setAddress] = useState('');
  const [googleRating, setGoogleRating] = useState('');
  const [mockupUrl, setMockupUrl] = useState('');
  const [stage, setStage] = useState<FunnelStageId>(defaultStage);
  const defaultScriptKey = Object.keys(niche.scripts)[0] || 'script1';
  const [scriptUsed, setScriptUsed] = useState<ScriptId>(defaultScriptKey);
  const [creationValue] = useState('');
  const [monthlyMrr] = useState('');

  const availableCities = Array.from(
    new Set([niche.city, ...(niche.targetCities || [])].filter(Boolean))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !phone.trim()) return;

    const cleanNum = cleanPhoneForWhatsApp(phone);

    onCreateLead({
      nicheId: niche.id,
      companyName: companyName.trim(),
      contactName: contactName.trim() || undefined,
      phone: cleanNum,
      displayPhone: formatDisplayPhone(cleanNum),
      category: category.trim() || undefined,
      city: city.trim() || niche.city,
      address: address.trim() || undefined,
      googleRating: googleRating ? parseFloat(googleRating) : undefined,
      mockupUrl: mockupUrl.trim() || undefined,
      stage,
      scriptUsed,
      creationValue: creationValue ? parseFloat(creationValue) : undefined,
      monthlyMrr: monthlyMrr ? parseFloat(monthlyMrr) : undefined,
    });

    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title="Novo Lead no Funil"
      subtitle={`Campanha: ${niche.emoji} ${niche.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="kaizen-new-lead-form" variant="primary">
            Adicionar Lead
          </Button>
        </>
      }
    >
      <form id="kaizen-new-lead-form" onSubmit={handleSubmit} className="space-y-3.5">
        <Input
          label="Nome da Empresa / Profissional"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Ex: Consultório Odontológico Vila Nova"
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nome do Responsável"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Ex: Dr. Roberto"
          />

          <Input
            label="WhatsApp com DDD"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="11988887777"
            className="font-mono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Categoria / Especialidade"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex: Nutricionista, Clínica"
          />

          <div>
            <Input
              label="Cidade de Prospecção"
              list="prospected-cities-list"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <datalist id="prospected-cities-list">
              {availableCities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Nota Google (1 a 5)"
            type="number"
            step="0.1"
            min="1"
            max="5"
            value={googleRating}
            onChange={(e) => setGoogleRating(e.target.value)}
            placeholder="4.8"
            className="font-mono"
            rightElement={<Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          />

          <Input
            label="Link do Mockup / Prévia"
            type="url"
            value={mockupUrl}
            onChange={(e) => setMockupUrl(e.target.value)}
            placeholder="https://..."
            className="font-mono"
          />
        </div>

        <Input
          label="Endereço / Bairro"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ex: Av. Brasil, 450"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Etapa Inicial no Funil"
            value={stage}
            onChange={(e) => setStage(e.target.value as FunnelStageId)}
          >
            {FUNNEL_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <Select
            label="Script Inicial"
            value={scriptUsed}
            onChange={(e) => setScriptUsed(e.target.value as ScriptId)}
          >
            {Object.values(niche.scripts).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            <option value="none">Sem script</option>
          </Select>
        </div>
      </form>
    </Modal>
  );
};
