import React, { useState } from 'react';
import { Lead, FunnelStageId, FUNNEL_STAGES, NicheCampaign } from '../types/crm';
import {
  isInactiveOver48h,
  buildWhatsAppLink,
  interpolateScript,
  formatDisplayPhone,
  formatFriendlyTime
} from '../utils/phone';
import {
  MessageCircle,
  Clock,
  Star,
  MapPin,
  ExternalLink,
  MoreVertical,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Copy,
  Check,
  Send,
  Calendar,
  PhoneCall
} from 'lucide-react';
import { DEFAULT_SCRIPTS } from '../utils/initialData';

interface LeadCardProps {
  lead: Lead;
  niche: NicheCampaign;
  userName: string;
  onClick: () => void;
  onMoveStage: (leadId: string, targetStage: FunnelStageId) => void;
  onFastWhatsAppContacted: (lead: Lead) => void;
  onSelectCity?: (city: string) => void;
  onOpenAgenda?: (leadId: string) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  niche,
  userName,
  onClick,
  onMoveStage,
  onFastWhatsAppContacted,
  onSelectCity,
  onOpenAgenda,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const inactive = isInactiveOver48h(lead.lastContactDate, lead.createdAt);

  // Script definition helper
  const scriptKey =
    lead.scriptUsed !== 'none' && niche.scripts[lead.scriptUsed]
      ? lead.scriptUsed
      : Object.keys(niche.scripts)[0] || 'script1';
  const scriptDef =
    niche.scripts[scriptKey] ||
    Object.values(niche.scripts)[0] ||
    DEFAULT_SCRIPTS.script1;

  const interpolatedMessage = interpolateScript(scriptDef.template, {
    empresa: lead.companyName,
    contato: lead.contactName,
    nicho: niche.segment,
    cidade: lead.city || niche.city,
    linkMockup: lead.mockupUrl,
    notaGoogle: lead.googleRating,
    seuNome: userName,
  });

  const waLink = buildWhatsAppLink(lead.phone, interpolatedMessage);

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFastWhatsAppContacted(lead);
    window.open(waLink, '_blank', 'noopener,noreferrer');
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(lead.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 1500);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Find next logical stage for quick advance
  const currentStageIndex = FUNNEL_STAGES.findIndex((s) => s.id === lead.stage);
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < FUNNEL_STAGES.length - 1
      ? FUNNEL_STAGES[currentStageIndex + 1]
      : null;

  const handleQuickAdvance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nextStage) {
      onMoveStage(lead.id, nextStage.id);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedLeadId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('leadId');
        if (draggedLeadId) {
          onMoveStage(draggedLeadId, lead.stage);
        }
      }}
      onClick={onClick}
      className={`group relative bg-white rounded-xl border transition-all duration-200 cursor-pointer p-3.5 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 ${
        inactive
          ? 'border-amber-300 ring-1 ring-amber-200/80 bg-amber-50/20'
          : 'border-slate-200/90 shadow-2xs'
      }`}
    >
      {/* Top Tag & Inactivity Banner & Last Contact Indicator */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {inactive ? (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full shrink-0">
              <Clock className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Inativo (+48h)</span>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[130px]">
              {scriptDef.title ? scriptDef.title.split('—')[0] : 'Script'}
            </span>
          )}

          {lead.lastContactDate ? (
            <span
              className="text-[10px] font-mono text-blue-700 bg-blue-50/90 border border-blue-200/50 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0"
              title={`Última mensagem enviada: ${new Date(lead.lastContactDate).toLocaleString('pt-BR')}`}
            >
              <Send className="w-2.5 h-2.5 text-blue-600" />
              <span>{formatFriendlyTime(lead.lastContactDate)}</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded shrink-0">
              Sem envio
            </span>
          )}
        </div>

        {/* Quick Menu */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Mover etapa"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMoveMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Mover para Etapa
              </div>
              {FUNNEL_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onMoveStage(lead.id, s.id);
                    setShowMoveMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
                    lead.stage === s.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{s.shortName}</span>
                  {lead.stage === s.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Company Name & Contact */}
      <div className="mb-2">
        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
          {lead.companyName}
        </h4>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {lead.contactName && (
            <span className="text-[11px] text-slate-500 font-medium truncate">
              {lead.contactName}
            </span>
          )}
          {lead.category && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md tracking-tight ${
                lead.category.toLowerCase().includes('academia') ||
                lead.category.toLowerCase().includes('suplement') ||
                lead.category.toLowerCase().includes('crossfit')
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              }`}
              title={`Categoria: ${lead.category}`}
            >
              {lead.category}
            </span>
          )}
        </div>
      </div>

      {/* Location & Google Rating */}
      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 mb-2.5">
        <button
          type="button"
          onClick={(e) => {
            if (onSelectCity && lead.city) {
              e.stopPropagation();
              onSelectCity(lead.city);
            }
          }}
          className={`flex items-center gap-1 truncate text-slate-600 rounded px-1 -mx-1 transition-colors text-left ${
            onSelectCity ? 'hover:bg-blue-50 hover:text-blue-700 cursor-pointer' : ''
          }`}
          title={onSelectCity ? `Filtrar pipeline pela cidade: ${lead.city || niche.city}` : undefined}
        >
          <MapPin className="w-3 h-3 shrink-0 text-blue-500" />
          <span className="truncate font-medium">{lead.city || niche.city}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {lead.googleMapsUrl && (
            <a
              href={lead.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-1.5 py-0.5 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors flex items-center gap-0.5 text-[10px] font-medium border border-blue-200/50"
              title="Abrir no Google Meu Negócio / Maps"
            >
              <span>GMB</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {lead.googleRating ? (
            <div className="flex items-center gap-0.5 font-mono text-[11px] text-amber-600 font-bold shrink-0 bg-amber-50 px-1.5 py-0.2 rounded-md">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{lead.googleRating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Phone with 1-click copy */}
      <div className="flex items-center justify-between gap-1 text-[11px] pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleCopyPhone}
          className="flex items-center gap-1 font-mono tabular-nums text-slate-700 hover:text-blue-600 font-semibold cursor-pointer group/copy"
          title="Clique para copiar telefone"
        >
          <span>{formatDisplayPhone(lead.phone)}</span>
          {copiedPhone ? (
            <Check className="w-3 h-3 text-emerald-600" />
          ) : (
            <Copy className="w-2.5 h-2.5 text-slate-400 group-hover/copy:text-blue-600" />
          )}
        </button>

        {lead.mockupUrl && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              window.open(lead.mockupUrl, '_blank', 'noopener,noreferrer');
            }}
            className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-bold cursor-pointer bg-blue-50/80 px-1.5 py-0.5 rounded"
            title="Abrir mockup interativo"
          >
            <span>Demo</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </span>
        )}
      </div>

      {/* Financials (Setup + MRR) if present */}
      {(lead.creationValue || lead.monthlyMrr) ? (
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono tabular-nums">
          {lead.creationValue ? (
            <span className="text-slate-700 font-semibold">
              R$ {lead.creationValue.toLocaleString('pt-BR')}
            </span>
          ) : <span />}
          {lead.monthlyMrr ? (
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold text-[10px]">
              +R$ {lead.monthlyMrr.toLocaleString('pt-BR')}/mês
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Meeting schedule tag if in reuniao_marcada */}
      {lead.stage === 'reuniao_marcada' && (
        <div
          onClick={(e) => {
            if (onOpenAgenda) {
              e.stopPropagation();
              onOpenAgenda(lead.id);
            }
          }}
          className={`mt-2 p-1.5 bg-emerald-50 border border-emerald-200/80 rounded-lg flex items-center justify-between text-[11px] text-emerald-950 transition-colors ${
            onOpenAgenda ? 'hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer' : ''
          }`}
          title="Clique para abrir e agendar na Agenda"
        >
          <div className="flex items-center gap-1 font-semibold truncate">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              {lead.meetingDate
                ? `${new Date(lead.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${lead.meetingTime ? ` às ${lead.meetingTime}` : ''}`
                : 'Definir dia na Agenda'}
            </span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded shrink-0">
            {lead.meetingDate ? 'Agendada' : 'Agendar 📅'}
          </span>
        </div>
      )}

      {/* Callback schedule tag (Pediu para falar outra hora / Ligar mais tarde) */}
      {lead.callbackDate && lead.callbackStatus !== 'realizado' && lead.callbackStatus !== 'cancelado' && (
        <div
          onClick={(e) => {
            if (onOpenAgenda) {
              e.stopPropagation();
              onOpenAgenda(lead.id);
            }
          }}
          className={`mt-2 p-1.5 rounded-lg flex items-center justify-between text-[11px] transition-colors border ${
            lead.callbackDate === new Date().toISOString().split('T')[0]
              ? 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-400 font-semibold'
              : 'bg-amber-50 text-amber-900 border-amber-200/80 hover:bg-amber-100'
          } ${onOpenAgenda ? 'cursor-pointer' : ''}`}
          title="Pediu para entrar em contato outra hora. Clique para gerenciar na Agenda."
        >
          <div className="flex items-center gap-1.5 font-semibold truncate">
            <PhoneCall className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              {lead.callbackDate === new Date().toISOString().split('T')[0]
                ? `Ligar Hoje${lead.callbackTime ? ` às ${lead.callbackTime}` : ''}`
                : `Retorno: ${new Date(lead.callbackDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${lead.callbackTime ? ` às ${lead.callbackTime}` : ''}`}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-amber-200/90 text-amber-900 px-1.5 py-0.2 rounded shrink-0">
            {lead.callbackNotes ? lead.callbackNotes.slice(0, 14) + (lead.callbackNotes.length > 14 ? '...' : '') : 'Retorno 📞'}
          </span>
        </div>
      )}

      {/* Action Row: Primary WhatsApp Call + Quick Advance button */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleWhatsAppClick}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
          title="Chamar no WhatsApp com a mensagem do script pronta"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
          <span>WhatsApp</span>
        </button>

        {nextStage && (
          <button
            type="button"
            onClick={handleQuickAdvance}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title={`Avançar para: ${nextStage.shortName}`}
          >
            <span className="hidden sm:inline">Avançar</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
};
