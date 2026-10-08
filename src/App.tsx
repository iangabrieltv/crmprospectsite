/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  NicheCampaign,
  Lead,
  ImportedSheet,
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
import { LoginView } from './components/LoginView';
import { DEFAULT_SCRIPTS, INITIAL_NICHES, INITIAL_LEADS } from './utils/initialData';
import {
  testFirestoreConnection,
  subscribeToNiches,
  subscribeToLeads,
  subscribeToImportedSheets,
  syncLeadToFirestore,
  deleteLeadFromFirestore,
  batchSyncLeadsToFirestore,
  syncNicheToFirestore,
  deleteNicheFromFirestore,
  syncImportedSheetToFirestore,
  deleteImportedSheetFromFirestore,
  seedFirestoreIfEmpty
} from './utils/firebase';

export default function App() {
  // Authentication gatekeeper (restricts access to authorized credentials adm.equipeie / adm123)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const local = localStorage.getItem('prospectflow_auth_user');
    const session = sessionStorage.getItem('prospectflow_auth_user');
    return local === 'adm.equipeie' || session === 'adm.equipeie';
  });

  const [niches, setNiches] = useState<NicheCampaign[]>(() => loadStoredNiches());
  const [leads, setLeads] = useState<Lead[]>(() => loadStoredLeads());
  const [importedSheets, setImportedSheets] = useState<ImportedSheet[]>([]);
  const [activeNicheId, setActiveNicheId] = useState<string>(() =>
    loadStoredActiveNicheId(niches[0]?.id || '')
  );
  const [userName, setUserName] = useState<string>(() => {
    const stored = loadStoredUserName();
    return stored && stored !== 'Gabriel' ? stored : 'adm.equipeie';
  });
  const [activeTab, setActiveTab] = useState<AppTab>('kanban');

  // Real-time Firestore synchronization between devices
  useEffect(() => {
    if (!isAuthenticated) return;

    // Test connection on boot
    testFirestoreConnection();

    // Seed database if cloud collection is currently empty
    seedFirestoreIfEmpty(INITIAL_NICHES, INITIAL_LEADS);

    // Subscribe to real-time niches updates across devices
    const unsubNiches = subscribeToNiches((remoteNiches) => {
      if (remoteNiches.length > 0) {
        const upgradedNiches = remoteNiches.map((n) => {
          if (n.scripts?.script2?.title?.includes('Diagnóstico Google') || !n.scripts?.script2) {
            const updated = {
              ...n,
              scripts: {
                ...n.scripts,
                script2: DEFAULT_SCRIPTS.script2,
              },
            };
            syncNicheToFirestore(updated).catch(console.error);
            return updated;
          }
          return n;
        });
        setNiches(upgradedNiches);
      }
    });

    // Subscribe to real-time leads updates across devices
    const unsubLeads = subscribeToLeads((remoteLeads) => {
      if (remoteLeads.length > 0) {
        setLeads(remoteLeads);
      } else {
        // Fallback recovery: if remote has 0 leads but local storage has leads, sync them up!
        const local = loadStoredLeads();
        if (local.length > 0) {
          batchSyncLeadsToFirestore(local).catch(console.error);
        }
      }
    });

    // Subscribe to real-time imported spreadsheets history
    const unsubSheets = subscribeToImportedSheets((remoteSheets) => {
      setImportedSheets(remoteSheets);
    });

    return () => {
      unsubNiches();
      unsubLeads();
      unsubSheets();
    };
  }, [isAuthenticated]);

  // Modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeLeadForScriptId, setActiveLeadForScriptId] = useState<string | null>(null);
  const [isNewNicheModalOpen, setIsNewNicheModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [newLeadDefaultStage, setNewLeadDefaultStage] = useState<FunnelStageId>('nao_iniciada');

  const handleOpenScriptForLead = (lead: Lead) => {
    setActiveLeadForScriptId(lead.id);
    setSelectedLead(null);
    setActiveTab('scripts');
  };

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
    let updatedLeadItem: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          const nowIso = new Date().toISOString();
          const autoNoteText = `Etapa alterada para: ${targetStage}`;
          const updated: Lead = {
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
          updatedLeadItem = updated;
          return updated;
        }
        return lead;
      })
    );
    if (updatedLeadItem) {
      syncLeadToFirestore(updatedLeadItem).catch(console.error);
    }
  };

  // Handler: Trigger WhatsApp contacted (advances from nao_iniciada if needed)
  const handleFastWhatsAppContacted = (leadToContact: Lead) => {
    let updatedLeadItem: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadToContact.id) {
          const nextStage = lead.stage === 'nao_iniciada' ? 'primeiro_contato' : lead.stage;
          const updated: Lead = {
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
          updatedLeadItem = updated;
          return updated;
        }
        return lead;
      })
    );
    if (updatedLeadItem) {
      syncLeadToFirestore(updatedLeadItem).catch(console.error);
    }
  };

  // Handler: Update lead details
  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    syncLeadToFirestore(updatedLead).catch(console.error);
  };

  // Handler: Delete single lead
  const handleDeleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    deleteLeadFromFirestore(leadId).catch(console.error);
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
    syncLeadToFirestore(newLead).catch(console.error);
  };

  // Handler: Create new niche
  const handleCreateNiche = (newNiche: NicheCampaign) => {
    setNiches((prev) => [...prev, newNiche]);
    setActiveNicheId(newNiche.id);
    syncNicheToFirestore(newNiche).catch(console.error);
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
    deleteNicheFromFirestore(nicheId).catch(console.error);
  };

  // Handler: Import multiple leads into niche
  const handleImportLeadsToNiche = async (
    targetNicheId: string,
    importedLeads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[],
    sheetMetadata?: { name: string; format?: string; size?: number }
  ) => {
    const targetNiche = niches.find((n) => n.id === targetNicheId) || activeNiche;
    const newLeads: Lead[] = importedLeads.map((imp, idx) => ({
      ...imp,
      id: 'lead-imp-' + Date.now() + '-' + idx,
      nicheId: targetNicheId,
      createdAt: new Date().toISOString(),
      notes: [
        {
          id: 'note-imp-' + idx,
          date: new Date().toLocaleDateString('pt-BR'),
          text: 'Lead importado via planilha.',
          author: userName,
        },
      ],
    }));
    setLeads((prev) => [...newLeads, ...prev]);

    const sheetRecord: ImportedSheet = {
      id: 'sheet-' + Date.now(),
      name: sheetMetadata?.name || `Planilha ${targetNiche.name} (${newLeads.length} leads)`,
      nicheId: targetNicheId,
      nicheName: targetNiche.name,
      importedAt: new Date().toISOString(),
      totalLeads: newLeads.length,
      format: sheetMetadata?.format,
      size: sheetMetadata?.size,
      leadsSummary: newLeads.slice(0, 10).map((l) => ({
        companyName: l.companyName,
        phone: l.phone,
        city: l.city,
        category: l.category,
      })),
    };

    try {
      await batchSyncLeadsToFirestore(newLeads);
      await syncImportedSheetToFirestore(sheetRecord);
    } catch (err) {
      console.error('Erro ao sincronizar importação no Firestore:', err);
    }
  };

  // Handler: Create new niche AND import leads into it
  const handleCreateNicheWithLeads = async (
    newNicheData: { name: string; segment: string; city: string; emoji: string },
    importedLeads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[],
    sheetMetadata?: { name: string; format?: string; size?: number }
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

    const sheetRecord: ImportedSheet = {
      id: 'sheet-' + Date.now(),
      name: sheetMetadata?.name || `Planilha ${newNiche.name} (${newLeads.length} leads)`,
      nicheId: newNicheId,
      nicheName: newNiche.name,
      importedAt: new Date().toISOString(),
      totalLeads: newLeads.length,
      format: sheetMetadata?.format,
      size: sheetMetadata?.size,
      leadsSummary: newLeads.slice(0, 10).map((l) => ({
        companyName: l.companyName,
        phone: l.phone,
        city: l.city,
        category: l.category,
      })),
    };

    try {
      await syncNicheToFirestore(newNiche);
      await batchSyncLeadsToFirestore(newLeads);
      await syncImportedSheetToFirestore(sheetRecord);
    } catch (err) {
      console.error('Erro ao sincronizar nova campanha e leads no Firestore:', err);
    }
  };

  // Handler: Delete imported sheet record
  const handleDeleteImportedSheet = async (sheetId: string) => {
    setImportedSheets((prev) => prev.filter((s) => s.id !== sheetId));
    try {
      await deleteImportedSheetFromFirestore(sheetId);
    } catch (err) {
      console.error('Erro ao excluir planilha do Firestore:', err);
    }
  };

  // Handler: Update niche script templates
  const handleUpdateNicheScripts = (updatedScripts: NicheCampaign['scripts']) => {
    if (!activeNiche) return;
    const updated = { ...activeNiche, scripts: updatedScripts };
    setNiches((prev) =>
      prev.map((n) => (n.id === activeNiche.id ? updated : n))
    );
    syncNicheToFirestore(updated).catch(console.error);
  };

  // Handler: Update niche target prospecting cities
  const handleUpdateNicheTargetCities = (targetCities: string[]) => {
    if (!activeNiche) return;
    const updated = { ...activeNiche, targetCities };
    setNiches((prev) =>
      prev.map((n) => (n.id === activeNiche.id ? updated : n))
    );
    syncNicheToFirestore(updated).catch(console.error);
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
    batchSyncLeadsToFirestore(newLeads).catch(console.error);
    for (const n of newNiches) {
      syncNicheToFirestore(n).catch(console.error);
    }
  };

  // Handler: Logout (restricts access and returns to login gate)
  const handleLogout = () => {
    localStorage.removeItem('prospectflow_auth_user');
    localStorage.removeItem('prospectflow_auth_session');
    sessionStorage.removeItem('prospectflow_auth_user');
    sessionStorage.removeItem('prospectflow_auth_session');
    setIsAuthenticated(false);
  };

  // 1. GESTÃO DE ACESSO: Se o usuário não estiver autenticado, exibe a tela de login
  if (!isAuthenticated) {
    return (
      <LoginView
        onSuccessLogin={(authorizedUser) => {
          setIsAuthenticated(true);
          setUserName(authorizedUser);
        }}
      />
    );
  }

  if (!activeNiche) {
    return (
      <div className="flex items-center justify-center min-h-screen text-xs text-slate-500">
        Carregando ProspectFlow...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans w-full max-w-full overflow-x-hidden">
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
        onLogout={handleLogout}
      />

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 flex flex-col min-w-0 w-full max-w-full">
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
            onUpdateNicheTargetCities={(cities) => handleUpdateNicheTargetCities(cities)}
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
            targetLeadId={activeLeadForScriptId}
            onUpdateNicheScripts={handleUpdateNicheScripts}
            onFastWhatsAppContacted={handleFastWhatsAppContacted}
          />
        )}

        {activeTab === 'importer' && (
          <ImporterView
            activeNiche={activeNiche}
            existingLeads={activeNicheLeads}
            importedSheets={importedSheets}
            onImportLeadsToNiche={handleImportLeadsToNiche}
            onCreateNicheWithLeads={handleCreateNicheWithLeads}
            onDeleteImportedSheet={handleDeleteImportedSheet}
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
          onOpenScriptForLead={handleOpenScriptForLead}
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
