/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  NicheCampaign,
  Lead,
  AppTab,
  FunnelStageId
} from './types/crm';
import {
  loadStoredNiches,
  saveStoredNiches,
  loadStoredLeads,
  saveStoredLeads,
  loadStoredActiveNicheId,
  saveStoredActiveNicheId,
  loadStoredUserName,
  saveStoredUserName
} from './utils/storage';
import { Header } from './components/Header';
import { KanbanView } from './components/KanbanView';
import { DashboardView } from './components/DashboardView';
import { ScriptsView } from './components/ScriptsView';
import { ImporterView } from './components/ImporterView';
import { GlobalAgencyView } from './components/GlobalAgencyView';
import { LeadModal } from './components/LeadModal';
import { NewNicheModal } from './components/NewNicheModal';
import { NewLeadModal } from './components/NewLeadModal';
import { DEFAULT_SCRIPTS } from './utils/initialData';

export default function App() {
  const [niches, setNiches] = useState<NicheCampaign[]>(() => loadStoredNiches());
  const [leads, setLeads] = useState<Lead[]>(() => loadStoredLeads());
  const [activeNicheId, setActiveNicheId] = useState<string>(() =>
    loadStoredActiveNicheId(niches[0]?.id || '')
  );
  const [userName, setUserName] = useState<string>(() => loadStoredUserName());
  const [activeTab, setActiveTab] = useState<AppTab>('kanban');

  // Modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isNewNicheModalOpen, setIsNewNicheModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [newLeadDefaultStage, setNewLeadDefaultStage] = useState<FunnelStageId>('nao_iniciada');

  // Active Niche resolution
  const activeNiche =
    niches.find((n) => n.id === activeNicheId) || niches[0];

  // Active niche leads
  const activeNicheLeads = leads.filter((l) => l.nicheId === activeNiche?.id);

  // Persistence effects
  useEffect(() => {
    saveStoredNiches(niches);
  }, [niches]);

  useEffect(() => {
    saveStoredLeads(leads);
  }, [leads]);

  useEffect(() => {
    if (activeNiche?.id) {
      saveStoredActiveNicheId(activeNiche.id);
    }
  }, [activeNiche?.id]);

  useEffect(() => {
    saveStoredUserName(userName);
  }, [userName]);

  // Handler: Move lead stage (Drag & Drop or dropdown)
  const handleMoveStage = (leadId: string, targetStage: FunnelStageId) => {
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          const nowIso = new Date().toISOString();
          const autoNoteText = `Etapa alterada para: ${targetStage}`;
          return {
            ...lead,
            stage: targetStage,
            lastContactDate: nowIso,
            notes: [
              {
                id: 'note-auto-' + Date.now(),
                date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                text: autoNoteText,
                author: 'Sistema',
              },
              ...lead.notes,
            ],
          };
        }
        return lead;
      })
    );
  };

  // Handler: Trigger WhatsApp contacted (advances from nao_iniciada if needed)
  const handleFastWhatsAppContacted = (leadToContact: Lead) => {
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadToContact.id) {
          const nextStage = lead.stage === 'nao_iniciada' ? 'primeiro_contato' : lead.stage;
          return {
            ...lead,
            stage: nextStage,
            lastContactDate: new Date().toISOString(),
            notes: [
              {
                id: 'note-wa-' + Date.now(),
                date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                text: `Mensagem de WhatsApp disparada usando ${lead.scriptUsed !== 'none' ? lead.scriptUsed : 'Script 1'}.`,
                author: userName,
              },
              ...lead.notes,
            ],
          };
        }
        return lead;
      })
    );
  };

  // Handler: Update lead details
  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
  };

  // Handler: Delete single lead
  const handleDeleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  // Handler: Create single lead manually
  const handleCreateLead = (newLeadData: Omit<Lead, 'id' | 'createdAt' | 'notes'>) => {
    const newLead: Lead = {
      ...newLeadData,
      id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
      notes: [
        {
          id: 'note-init-' + Date.now(),
          date: new Date().toLocaleDateString('pt-BR'),
          text: 'Lead cadastrado no CRM.',
          author: userName,
        },
      ],
    };
    setLeads((prev) => [newLead, ...prev]);
  };

  // Handler: Create new niche
  const handleCreateNiche = (newNiche: NicheCampaign) => {
    setNiches((prev) => [...prev, newNiche]);
    setActiveNicheId(newNiche.id);
  };

  // Handler: Delete niche
  const handleDeleteNiche = (nicheId: string) => {
    if (niches.length <= 1) {
      alert('Não é possível excluir o único nicho restante.');
      return;
    }
    const remaining = niches.filter((n) => n.id !== nicheId);
    setNiches(remaining);
    setLeads((prev) => prev.filter((l) => l.nicheId !== nicheId));
    if (activeNicheId === nicheId) {
      setActiveNicheId(remaining[0].id);
    }
  };

  // Handler: Import multiple leads into niche
  const handleImportLeadsToNiche = (
    targetNicheId: string,
    importedLeads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[]
  ) => {
    const newLeads: Lead[] = importedLeads.map((imp, idx) => ({
      ...imp,
      id: 'lead-imp-' + Date.now() + '-' + idx,
      nicheId: targetNicheId,
      createdAt: new Date().toISOString(),
      notes: [
        {
          id: 'note-imp-' + idx,
          date: new Date().toLocaleDateString('pt-BR'),
          text: 'Lead importado via importador inteligente.',
          author: userName,
        },
      ],
    }));
    setLeads((prev) => [...newLeads, ...prev]);
  };

  // Handler: Create new niche AND import leads into it
  const handleCreateNicheWithLeads = (
    newNicheData: { name: string; segment: string; city: string; emoji: string },
    importedLeads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[]
  ) => {
    const newNicheId = 'niche-' + Date.now();
    const newNiche: NicheCampaign = {
      id: newNicheId,
      name: newNicheData.name,
      segment: newNicheData.segment,
      city: newNicheData.city,
      emoji: newNicheData.emoji,
      targetMrr: 5000,
      createdAt: new Date().toISOString(),
      scripts: { ...DEFAULT_SCRIPTS },
    };

    const newLeads: Lead[] = importedLeads.map((imp, idx) => ({
      ...imp,
      id: 'lead-imp-' + Date.now() + '-' + idx,
      nicheId: newNicheId,
      createdAt: new Date().toISOString(),
      notes: [
        {
          id: 'note-imp-' + idx,
          date: new Date().toLocaleDateString('pt-BR'),
          text: 'Lead importado ao criar nova campanha.',
          author: userName,
        },
      ],
    }));

    setNiches((prev) => [...prev, newNiche]);
    setLeads((prev) => [...newLeads, ...prev]);
    setActiveNicheId(newNicheId);
  };

  // Handler: Update niche script templates
  const handleUpdateNicheScripts = (updatedScripts: NicheCampaign['scripts']) => {
    if (!activeNiche) return;
    setNiches((prev) =>
      prev.map((n) => (n.id === activeNiche.id ? { ...n, scripts: updatedScripts } : n))
    );
  };

  // Handler: Restore full backup
  const handleRestoreBackup = (
    newNiches: NicheCampaign[],
    newLeads: Lead[],
    newUserName?: string
  ) => {
    setNiches(newNiches);
    setLeads(newLeads);
    if (newNiches[0]) {
      setActiveNicheId(newNiches[0].id);
    }
    if (newUserName) {
      setUserName(newUserName);
    }
  };

  if (!activeNiche) {
    return (
      <div className="flex items-center justify-center min-h-screen text-xs text-slate-500">
        Carregando ProspectFlow...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Global Top Bar Navigation */}
      <Header
        niches={niches}
        activeNiche={activeNiche}
        onSelectNiche={(id) => setActiveNicheId(id)}
        onOpenNewNicheModal={() => setIsNewNicheModalOpen(true)}
        onOpenNewLeadModal={() => {
          setNewLeadDefaultStage('nao_iniciada');
          setIsNewLeadModalOpen(true);
        }}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        userName={userName}
        onUpdateUserName={(name) => setUserName(name)}
        totalLeadsCount={activeNicheLeads.length}
      />

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'kanban' && (
          <KanbanView
            niche={activeNiche}
            leads={activeNicheLeads}
            userName={userName}
            onMoveStage={handleMoveStage}
            onOpenLeadModal={(lead) => setSelectedLead(lead)}
            onOpenNewLeadModal={(stage) => {
              setNewLeadDefaultStage(stage || 'nao_iniciada');
              setIsNewLeadModalOpen(true);
            }}
            onFastWhatsAppContacted={handleFastWhatsAppContacted}
            onSwitchToImporter={() => setActiveTab('importer')}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView niche={activeNiche} leads={activeNicheLeads} />
        )}

        {activeTab === 'scripts' && (
          <ScriptsView
            niche={activeNiche}
            leads={activeNicheLeads}
            userName={userName}
            onUpdateNicheScripts={handleUpdateNicheScripts}
            onFastWhatsAppContacted={handleFastWhatsAppContacted}
          />
        )}

        {activeTab === 'importer' && (
          <ImporterView
            activeNiche={activeNiche}
            onImportLeadsToNiche={handleImportLeadsToNiche}
            onCreateNicheWithLeads={handleCreateNicheWithLeads}
            onSwitchToKanban={() => setActiveTab('kanban')}
          />
        )}

        {activeTab === 'global' && (
          <GlobalAgencyView
            niches={niches}
            leads={leads}
            userName={userName}
            onSelectNiche={(id) => {
              setActiveNicheId(id);
              setActiveTab('kanban');
            }}
            onOpenNewNicheModal={() => setIsNewNicheModalOpen(true)}
            onDeleteNiche={handleDeleteNiche}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </main>

      {/* Lead Detail & Edit Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          niche={activeNiche}
          userName={userName}
          onClose={() => setSelectedLead(null)}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
          onFastWhatsAppContacted={handleFastWhatsAppContacted}
        />
      )}

      {/* New Niche Campaign Modal */}
      {isNewNicheModalOpen && (
        <NewNicheModal
          onClose={() => setIsNewNicheModalOpen(false)}
          onCreateNiche={handleCreateNiche}
        />
      )}

      {/* New Lead Modal */}
      {isNewLeadModalOpen && (
        <NewLeadModal
          niche={activeNiche}
          defaultStage={newLeadDefaultStage}
          onClose={() => setIsNewLeadModalOpen(false)}
          onCreateLead={handleCreateLead}
        />
      )}
    </div>
  );
}
