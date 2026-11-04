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
  FunnelStageId,
  FUNNEL_STAGES,
  normalizeStageId
} from './types/crm';
import {
  loadStoredNiches,
  saveStoredNiches,
  loadStoredLeads,
  saveStoredLeads,
  clearStoredLeads,
  loadStoredActiveNicheId,
  saveStoredActiveNicheId,
  loadStoredUserName,
  saveStoredUserName
} from './utils/storage';
import { Header } from './components/Header';
import { KanbanView } from './components/KanbanView';
import { AgendaView } from './components/AgendaView';
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
  seedFirestoreIfEmpty,
  clearAllLeadsFromFirestore,
  clearAllImportedSheetsFromFirestore,
  purgeOldSampleNichesFromFirestore,
  resetFirestoreToCleanBaseline
} from './utils/firebase';
import { resetAllDataToCleanBaseline } from './utils/storage';

export default function App() {
  // Authentication gatekeeper (restricts access to authorized credentials kaizenvisual123 / adm123)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const local = localStorage.getItem('prospectflow_auth_user');
    const session = sessionStorage.getItem('prospectflow_auth_user');
    return (
      local === 'kaizenvisual123' ||
      session === 'kaizenvisual123' ||
      local === 'adm.equipeie' ||
      session === 'adm.equipeie'
    );
  });

  const [niches, setNiches] = useState<NicheCampaign[]>(() => loadStoredNiches());
  const [leads, setLeads] = useState<Lead[]>(() => loadStoredLeads());
  const [importedSheets, setImportedSheets] = useState<ImportedSheet[]>([]);
  const [activeNicheId, setActiveNicheId] = useState<string>(() =>
    loadStoredActiveNicheId(niches[0]?.id || '')
  );
  const [userName, setUserName] = useState<string>(() => {
    const stored = loadStoredUserName();
    return stored && stored !== 'Gabriel' && stored !== 'adm.equipeie' ? stored : 'kaizenvisual123';
  });
  const [activeTab, setActiveTab] = useState<AppTab>('kanban');
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);

  // Real-time Firestore synchronization between devices and tabs
  useEffect(() => {
    if (!isAuthenticated) return;

    // Test connection on boot
    testFirestoreConnection().then((connected) => {
      setIsCloudSynced(connected);
    });

    // Clean legacy sample niches from Firestore (advogados, carros, clinicas)
    purgeOldSampleNichesFromFirestore(INITIAL_NICHES).catch(console.error);

    // Seed database if cloud collection is currently empty
    seedFirestoreIfEmpty(INITIAL_NICHES, INITIAL_LEADS);

    // Subscribe to real-time niches updates across devices
    const unsubNiches = subscribeToNiches((remoteNiches) => {
      setIsCloudSynced(true);
      if (remoteNiches.length > 0) {
        // Filter out legacy sample niches if present in remote
        const cleanRemote = remoteNiches.filter((n) => {
          const lowerName = (n.name || '').toLowerCase();
          const lowerId = (n.id || '').toLowerCase();
          return (
            !lowerId.includes('estetica-automotiva') &&
            !lowerId.includes('clinicas-locais') &&
            !lowerId.includes('nutricionistas') &&
            !lowerId.includes('odontologia') &&
            !lowerName.includes('estética automotiva') &&
            !lowerName.includes('advogad') &&
            !lowerName.includes('advocacia') &&
            !lowerName.includes('carro') &&
            !lowerName.includes('automot')
          );
        });

        if (cleanRemote.length > 0) {
          const upgradedNiches = cleanRemote.map((n) => {
            const hasOldTemplate =
              n.scripts?.script_mensagem?.template?.includes('Kaizen Visual') ||
              n.scripts?.script_ligacao?.template?.includes('Kaizen Visual') ||
              n.scripts?.script_mensagem?.template?.includes('dois minutinhos') ||
              n.scripts?.script_ligacao?.template?.includes('dois minutinhos') ||
              n.scripts?.script_mensagem?.template?.includes('{NomeContato}') ||
              n.scripts?.script_ligacao?.template?.includes('{NomeContato}');

            if (!n.scripts?.script_mensagem || !n.scripts?.script_ligacao || Object.keys(n.scripts || {}).length !== 2 || hasOldTemplate) {
              const updated = {
                ...n,
                scripts: {
                  script_mensagem: hasOldTemplate ? DEFAULT_SCRIPTS.script_mensagem : (n.scripts?.script_mensagem || DEFAULT_SCRIPTS.script_mensagem),
                  script_ligacao: hasOldTemplate ? DEFAULT_SCRIPTS.script_ligacao : (n.scripts?.script_ligacao || DEFAULT_SCRIPTS.script_ligacao),
                },
              };
              syncNicheToFirestore(updated).catch(console.error);
              return updated;
            }
            return n;
          });

          setNiches((prev) => {
            const map = new Map<string, NicheCampaign>();
            upgradedNiches.forEach((n) => map.set(n.id, n));
            // Keep newly created local niches
            prev.forEach((p) => {
              if (!map.has(p.id) && !cleanRemote.some((r) => r.id === p.id)) {
                map.set(p.id, p);
              }
            });
            return Array.from(map.values());
          });
        }
      }
    });

    // Subscribe to real-time leads updates across devices and tabs
    const unsubLeads = subscribeToLeads((remoteLeads) => {
      setIsCloudSynced(true);
      setLeads((prev) => {
        // Protect newly imported leads from being temporarily wiped before remote acknowledges
        if (remoteLeads.length === 0 && prev.length > 0) {
          return prev;
        }
        const map = new Map<string, Lead>();
        remoteLeads.forEach((l) => map.set(l.id, l));
        // Preserve any pending local leads
        prev.forEach((l) => {
          if (!map.has(l.id)) {
            map.set(l.id, l);
          }
        });
        const merged = Array.from(map.values());
        saveStoredLeads(merged);
        return merged;
      });
    });

    // Subscribe to real-time imported spreadsheets history
    const unsubSheets = subscribeToImportedSheets((remoteSheets) => {
      setIsCloudSynced(true);
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
  const [activeLeadForAgendaId, setActiveLeadForAgendaId] = useState<string | null>(null);
  const [isNewNicheModalOpen, setIsNewNicheModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [newLeadDefaultStage, setNewLeadDefaultStage] = useState<FunnelStageId>('leads_sem_contato');

  const handleOpenScriptForLead = (lead: Lead) => {
    setActiveLeadForScriptId(lead.id);
    setSelectedLead(null);
    setActiveTab('scripts');
  };

  const handleOpenAgendaForLead = (leadId?: string) => {
    if (leadId) {
      setActiveLeadForAgendaId(leadId);
    }
    setSelectedLead(null);
    setActiveTab('agenda');
  };

  // Active Niche resolution
  const activeNiche =
    niches.find((n) => n.id === activeNicheId) || niches[0];

  // Active niche leads: robust fallback so imported leads never vanish
  const activeNicheLeads = leads.filter((l) => {
    if (!activeNiche) return true;
    if (niches.length <= 1) return true;
    if (!l.nicheId) return true;
    return l.nicheId === activeNiche.id;
  });

  // Total meetings count across all active leads in "reuniao_marcada"
  const meetingLeadsCount = leads.filter((l) => l.stage === 'reuniao_marcada').length;

  // Total callbacks scheduled for today
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayCallbacksCount = leads.filter(
    (l) => l.callbackDate === todayDateStr && l.callbackStatus !== 'realizado' && l.callbackStatus !== 'cancelado'
  ).length;

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
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    const normalizedTarget = normalizeStageId(targetStage);
    const stageConfig = FUNNEL_STAGES.find((s) => s.id === normalizedTarget);
    const stageName = stageConfig?.name || normalizedTarget;
    const autoNoteText = `Etapa alterada para: ${stageName}`;

    // Note: Do NOT overwrite lastContactDate when moving stages in pipeline!
    // Overwriting lastContactDate caused leads to disappear if the "Sem Msg" filter was active.
    const updated: Lead = {
      ...targetLead,
      stage: normalizedTarget,
      notes: [
        {
          id: 'note-auto-' + Date.now(),
          date:
            new Date().toLocaleDateString('pt-BR') +
            ' ' +
            new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          text: autoNoteText,
          author: userName || 'Sistema',
        },
        ...(targetLead.notes || []),
      ],
    };

    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updated : lead)));
    syncLeadToFirestore(updated).catch((err) => {
      console.error('Erro ao sincronizar movimentação no Firestore:', err);
    });
  };

  // Handler: Trigger WhatsApp contacted (advances from leads_sem_contato if needed)
  const handleFastWhatsAppContacted = (leadToContact: Lead) => {
    const currentNorm = normalizeStageId(leadToContact.stage);
    const nextStage = currentNorm === 'leads_sem_contato' ? 'primeiro_contato' : currentNorm;

    const updated: Lead = {
      ...leadToContact,
      stage: nextStage,
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: 'note-wa-' + Date.now(),
          date:
            new Date().toLocaleDateString('pt-BR') +
            ' ' +
            new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          text: `Mensagem de WhatsApp disparada usando ${leadToContact.scriptUsed !== 'none' ? leadToContact.scriptUsed : 'Script 1'}.`,
          author: userName || 'Sistema',
        },
        ...(leadToContact.notes || []),
      ],
    };

    setLeads((prev) => prev.map((l) => (l.id === leadToContact.id ? updated : l)));
    syncLeadToFirestore(updated).catch((err) => {
      console.error('Erro ao sincronizar WhatsApp no Firestore:', err);
    });
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

  // Handler: Clear all data from cloud & local storage (start 100% clean from scratch)
  const handleClearAllContacts = async () => {
    setIsCloudSynced(false);
    try {
      await resetFirestoreToCleanBaseline(INITIAL_NICHES);
      resetAllDataToCleanBaseline();
      setLeads([]);
      setImportedSheets([]);
      setNiches(INITIAL_NICHES);
      setActiveNicheId(INITIAL_NICHES[0].id);
      setIsCloudSynced(true);
    } catch (err) {
      console.error('Erro ao resetar banco de dados:', err);
      setIsCloudSynced(true);
      throw err;
    }
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
          setNewLeadDefaultStage('leads_sem_contato');
          setIsNewLeadModalOpen(true);
        }}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        userName={userName}
        onUpdateUserName={(name) => setUserName(name)}
        totalLeadsCount={activeNicheLeads.length}
        meetingsCount={meetingLeadsCount}
        callbacksCount={todayCallbacksCount}
        onLogout={handleLogout}
        isCloudSynced={isCloudSynced}
        onClearAllContacts={handleClearAllContacts}
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
              setNewLeadDefaultStage(stage || 'leads_sem_contato');
              setIsNewLeadModalOpen(true);
            }}
            onFastWhatsAppContacted={handleFastWhatsAppContacted}
            onSwitchToImporter={() => setActiveTab('importer')}
            onSwitchToAgenda={handleOpenAgendaForLead}
            onUpdateNicheTargetCities={(cities) => handleUpdateNicheTargetCities(cities)}
          />
        )}

        {activeTab === 'agenda' && (
          <AgendaView
            niche={activeNiche}
            leads={activeNicheLeads}
            allLeads={leads}
            userName={userName}
            initialLeadIdToEdit={activeLeadForAgendaId}
            onClearInitialLeadToEdit={() => setActiveLeadForAgendaId(null)}
            onUpdateLead={handleUpdateLead}
            onMoveStage={handleMoveStage}
            onOpenLeadModal={(lead: Lead) => setSelectedLead(lead)}
            onSwitchToKanban={() => setActiveTab('kanban')}
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
