import React, { useState } from 'react';
import { Lead, FunnelStageId, FUNNEL_STAGES, NicheCampaign, ScriptId } from '../types/crm';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { X, Plus, Star } from 'lucide-react';

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
  const [creationValue, setCreationValue] = useState('');
  const [monthlyMrr, setMonthlyMrr] = useState('');

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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              + Novo Lead no Funil
            </h3>
            <span className="text-[11px] text-slate-500">
              Campanha: {niche.emoji} {niche.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Empresa / Profissional *
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Consultório Odontológico Vila Nova"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Responsável
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Dr. Roberto"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp com DDD *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11988887777"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoria / Especialidade
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Nutricionista, Clínica"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cidade de Prospecção
              </label>
              <input
                type="text"
                list="prospected-cities-list"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
              <datalist id="prospected-cities-list">
                {availableCities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nota Google (1 a 5)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={googleRating}
                  onChange={(e) => setGoogleRating(e.target.value)}
                  placeholder="4.8"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                />
                <Star className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 fill-amber-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link do Mockup / Prévia
              </label>
              <input
                type="url"
                value={mockupUrl}
                onChange={(e) => setMockupUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço / Bairro
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Av. Brasil, 450"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Etapa Inicial no Funil
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as FunnelStageId)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
              >
                {FUNNEL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Script Inicial
              </label>
              <select
                value={scriptUsed}
                onChange={(e) => setScriptUsed(e.target.value as ScriptId)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              >
                {Object.values(niche.scripts).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
                <option value="none">Sem script</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Link da Demonstração / Mockup (opcional)
            </label>
            <input
              type="url"
              value={mockupUrl}
              onChange={(e) => setMockupUrl(e.target.value)}
              placeholder="https://framer.com/share/..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              Adicionar Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
