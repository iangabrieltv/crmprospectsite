/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  NicheCampaign,
  Lead,
  ImportedSheet,
  AppTab,
  FunnelStageId,
  FUNNEL_STAGES,
  normalizeStageId,
} from './types/crm';
import {
  loadStoredNiches,
  saveStoredNiches,
  loadStoredLeads,
  saveStoredLeads,
  loadStoredActiveNicheId,
  saveStoredActiveNicheId,
  loadStoredUserName,
  saveStoredUserName,
  loadLastBackupTimestamp,
  resetAllDataToCleanBaseline,
} from './utils/storage';
import { Header } from './components/Header';
import { KanbanView } from './components/KanbanView';
import { AgendaView } from './components/AgendaView';
import { DashboardView } from './components/DashboardView';
import { ScriptsView } from './components/ScriptsView';
import { ImporterView } from './components/ImporterView';
import { GlobalAgencyView, DeleteNicheChoice } from './components/GlobalAgencyView';
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
  batchSyncNichesToFirestore,
  batchSyncImportedSheetsToFirestore,
  batchDeleteLeadsFromFirestore,
  reassignLeadsNicheInFirestore,
  syncNicheToFirestore,
  deleteNicheFromFirestore,
  syncImportedSheetToFirestore,
  deleteImportedSheetFromFirestore,
  seedFirestoreIfEmpty,
  resetFirestoreToCleanBaseline,
} from './utils/firebase';
import {
  subscribeToAdminSession,
  logoutFromFirebase,
} from './services/authService';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function App() {
  // Real Firebase Authentication session gate (single authorized admin user)
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authConfigValid, setAuthConfigValid] = useState<boolean>(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [niches, setNiches] = useState<NicheCampaign[]>(() => loadStoredNiches());
  const [leads, setLeads] = useState<Lead[]>(() => loadStoredLeads());
  const [importedSheets, setImportedSheets] = useState<ImportedSheet[]>([]);
  const [activeNicheId, setActiveNicheId] = useState<string>(() =>
    loadStoredActiveNicheId(niches[0]?.id || '')
  );
  const [userName, setUserName] = useState<string>(() => loadStoredUserName());
  const [activeTab, setActiveTab] = useState<AppTab>('kanban');

  // Explicit cloud sync feedback & error handling
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const notifySaved = useCallback((message?: string) => {
    setSyncStatus('synced');
    setIsCloudSynced(true);
    setSyncError(null);
    if (message) {
      setSyncToast(message);
      setTimeout(() => {
        setSyncToast((prev) => (prev === message ? null : prev));
      }, 3000);
    }
  }, []);

  const notifySyncFailure = useCallback((context: string, err: unknown) => {
    const detail = err instanceof Error ? err.message : 'Erro desconhecido';
    setSyncStatus('error');
    setSyncError(`Falha ao sincronizar com o Firestore (${context}): ${detail}`);
  }, []);

  // Subscribe to Firebase Authentication session
  useEffect(() => {
    const unsub = subscribeToAdminSession(({ authorized, configValid, reason }) => {
      setAuthConfigValid(configValid);
      setIsAuthenticated(Boolean(configValid && authorized));
      setAuthReady(true);
      if ((!configValid || !authorized) && reason) {
        setSessionNotice(reason);
      } else if (configValid && authorized) {
        setSessionNotice(null);
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firestore synchronization (only runs when authenticated and config valid)
  useEffect(() => {
    if (!authReady || !isAuthenticated || !authConfigValid) return;

    let active = true;

    testFirestoreConnection().then((connected) => {
      if (!active) return;
      setIsCloudSynced(connected);
      if (!connected) {
        setSyncStatus('error');
        setSyncError('Não foi possível conectar ao Cloud Firestore. Verifique permissões ou internet.');
      }
    });

    // Safe non-destructive seed: creates baseline niche ONLY if collection is completely empty
    seedFirestoreIfEmpty(INITIAL_NICHES, INITIAL_LEADS);

    const unsubNiches = subscribeToNiches(
      (remoteNiches) => {
        if (!active) return;
        setIsCloudSynced(true);
        setSyncStatus((prev) => (prev === 'error' ? 'synced' : prev));

        if (remoteNiches.length > 0) {
          // Read-only normalization in memory — NEVER deletes niches or overwrites custom scripts
          const normalizedRemote = remoteNiches.map((n) => ({
            ...n,
            scripts:
              n.scripts && Object.keys(n.scripts).length > 0
                ? n.scripts
                : { ...DEFAULT_SCRIPTS },
          }));

          setNiches(normalizedRemote);
          saveStoredNiches(normalizedRemote);
        }
      },
      (err) => {
        if (!active) return;
        notifySyncFailure('leitura de nichos', err);
      }
    );

    const unsubLeads = subscribeToLeads(
      (remoteLeads) => {
        if (!active) return;
        setIsCloudSynced(true);
        setSyncStatus((prev) => (prev === 'error' ? 'synced' : prev));

        // Cloud Firestore is source of truth once authenticated; only normalize stage in memory
        const normalizedRemote = remoteLeads.map((l) => ({
          ...l,
          stage: normalizeStageId(l.stage),
          notes: Array.isArray(l.notes) ? l.notes : [],
        }));

        setLeads(normalizedRemote);
        saveStoredLeads(normalizedRemote);
      },
      (err) => {
        if (!active) return;
        notifySyncFailure('leitura de leads', err);
      }
    );

    const unsubSheets = subscribeToImportedSheets(
      (remoteSheets) => {
        if (!active) return;
        setIsCloudSynced(true);
        setImportedSheets(remoteSheets);
      },
      (err) => {
        if (!active) return;
        notifySyncFailure('leitura de planilhas importadas', err);
      }
    );

    return () => {
      active = false;
      unsubNiches();
      unsubLeads();
      unsubSheets();
    };
  }, [authReady, isAuthenticated, authConfigValid, notifySyncFailure]);

  // Modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeLeadForScriptId, setActiveLeadForScriptId] = useState<string | null>(null);
  const [activeLeadForAgendaId, setActiveLeadForAgendaId] = useState<string | null>(null);
  const [isNewNicheModalOpen, setIsNewNicheModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [newLeadDefaultStage, setNewLeadDefaultStage] =
    useState<FunnelStageId>('leads_sem_contato');

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
  const activeNiche = niches.find((n) => n.id === activeNicheId) || niches[0];

  // Active niche leads
  const activeNicheLeads = leads.filter((l) => {
    if (!activeNiche) return true;
    if (niches.length <= 1) return true;
    if (!l.nicheId) return true;
    return l.nicheId === activeNiche.id;
  });

  const meetingLeadsCount = leads.filter((l) => l.stage === 'reuniao_marcada').length;
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayCallbacksCount = leads.filter(
    (l) =>
      l.callbackDate === todayDateStr &&
      l.callbackStatus !== 'realizado' &&
      l.callbackStatus !== 'cancelado'
  ).length;

  // Local cache mirror
  useEffect(() => {
    if (activeNiche?.id) {
      saveStoredActiveNicheId(activeNiche.id);
    }
  }, [activeNiche?.id]);

  useEffect(() => {
    saveStoredUserName(userName);
  }, [userName]);

  // Handler: Move lead stage (waits for Firestore confirmation; rolls back on error)
  const handleMoveStage = async (leadId: string, targetStage: FunnelStageId) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    const previousLeads = leads;
    const normalizedTarget = normalizeStageId(targetStage);
    const stageConfig = FUNNEL_STAGES.find((s) => s.id === normalizedTarget);
    const stageName = stageConfig?.name || normalizedTarget;
    const autoNoteText = `Etapa alterada para: ${stageName}`;

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

    setSyncStatus('saving');
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updated : lead)));

    try {
      await syncLeadToFirestore(updated);
      notifySaved();
    } catch (err) {
      setLeads(previousLeads);
      notifySyncFailure('movimentação de etapa', err);
    }
  };

  // Handler: Trigger WhatsApp contacted (awaits Firestore confirmation)
  const handleFastWhatsAppContacted = async (leadToContact: Lead) => {
    const currentNorm = normalizeStageId(leadToContact.stage);
    let nextStage: FunnelStageId = currentNorm;

    if (currentNorm === 'leads_sem_contato') {
      nextStage = 'primeiro_contato';
    } else if (currentNorm === 'primeiro_contato') {
      nextStage = 'follow_up_1';
    }

    const stageConfig = FUNNEL_STAGES.find((s) => s.id === nextStage);
    const stageName = stageConfig?.name || nextStage;
    const previousLeads = leads;

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
          text: `Mensagem de WhatsApp disparada (etapa: ${stageName}).`,
          author: userName || 'Sistema',
        },
        ...(leadToContact.notes || []),
      ],
    };

    setSyncStatus('saving');
    setLeads((prev) => prev.map((l) => (l.id === leadToContact.id ? updated : l)));

    try {
      await syncLeadToFirestore(updated);
      notifySaved();
    } catch (err) {
      setLeads(previousLeads);
      notifySyncFailure('registro de disparo WhatsApp', err);
    }
  };

  // Handler: Update lead details
  const handleUpdateLead = async (updatedLead: Lead) => {
    const previousLeads = leads;
    setSyncStatus('saving');
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));

    try {
      await syncLeadToFirestore(updatedLead);
      notifySaved('Lead salvo no Firestore.');
    } catch (err) {
      setLeads(previousLeads);
      notifySyncFailure('atualização do lead', err);
    }
  };

  // Handler: Delete single lead (consistent between UI and Firestore)
  const handleDeleteLead = async (leadId: string) => {
    const previousLeads = leads;
    setSyncStatus('saving');
    setLeads((prev) => prev.filter((l) => l.id !== leadId));

    try {
      await deleteLeadFromFirestore(leadId);
      notifySaved('Lead excluído do Firestore.');
    } catch (err) {
      setLeads(previousLeads);
      notifySyncFailure('exclusão do lead', err);
    }
  };

  // Handler: Create single lead manually
  const handleCreateLead = async (newLeadData: Omit<Lead, 'id' | 'createdAt' | 'notes'>) => {
    const previousLeads = leads;
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

    setSyncStatus('saving');
    setLeads((prev) => [newLead, ...prev]);

    try {
      await syncLeadToFirestore(newLead);
      notifySaved('Lead cadastrado e salvo na nuvem.');
    } catch (err) {
      setLeads(previousLeads);
      notifySyncFailure('cadastro de lead', err);
    }
  };

  // Handler: Create new niche
  const handleCreateNiche = async (newNiche: NicheCampaign) => {
    const previousNiches = niches;
    const previousActive = activeNicheId;

    setSyncStatus('saving');
    setNiches((prev) => [...prev, newNiche]);
    setActiveNicheId(newNiche.id);

    try {
      await syncNicheToFirestore(newNiche);
      notifySaved('Novo nicho salvo na nuvem.');
    } catch (err) {
      setNiches(previousNiches);
      setActiveNicheId(previousActive);
      notifySyncFailure('criação de nicho', err);
    }
  };

  // Handler: Delete niche with explicit treatment of linked leads (never leaves orphans)
  const handleDeleteNiche = async (choice: DeleteNicheChoice) => {
    if (niches.length <= 1) {
      throw new Error('Não é possível excluir o único nicho restante.');
    }

    const { nicheId, mode, targetNicheId } = choice;
    const linkedLeads = leads.filter((l) => l.nicheId === nicheId);
    const linkedIds = linkedLeads.map((l) => l.id);

    setSyncStatus('saving');
    try {
      if (linkedIds.length > 0) {
        if (mode === 'move_leads') {
          if (!targetNicheId) {
            throw new Error('Selecione um nicho de destino para transferir os leads.');
          }
          await reassignLeadsNicheInFirestore(linkedIds, targetNicheId);
        } else {
          await batchDeleteLeadsFromFirestore(linkedIds);
        }
      }

      await deleteNicheFromFirestore(nicheId);

      const remaining = niches.filter((n) => n.id !== nicheId);
      setNiches(remaining);
      if (mode === 'move_leads' && targetNicheId) {
        setLeads((prev) =>
          prev.map((l) => (l.nicheId === nicheId ? { ...l, nicheId: targetNicheId } : l))
        );
      } else {
        setLeads((prev) => prev.filter((l) => l.nicheId !== nicheId));
      }

      if (activeNicheId === nicheId && remaining[0]) {
        setActiveNicheId(remaining[0].id);
      }

      notifySaved('Nicho atualizado com sucesso no Firestore.');
    } catch (err) {
      notifySyncFailure('exclusão de nicho', err);
      throw err;
    }
  };

  // Handler: Import multiple leads into niche (awaited)
  const handleImportLeadsToNiche = async (
    targetNicheId: string,
    importedLeads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[],
    sheetMetadata?: { name: string; format?: string; size?: number }
  ) => {
    const targetNiche = niches.find((n) => n.id === targetNicheId) || activeNiche;
    const baseTs = Date.now();
    const newLeads: Lead[] = importedLeads.map((imp, idx) => ({
      ...imp,
      id: `lead-imp-${baseTs}-${idx}`,
      nicheId: targetNicheId,
      createdAt: new Date().toISOString(),
      notes: [
        {
          id: `note-imp-${baseTs}-${idx}`,
          date: new Date().toLocaleDateString('pt-BR'),
          text: 'Lead importado via planilha.',
          author: userName,
        },
      ],
    }));

    const sheetRecord: ImportedSheet = {
      id: 'sheet-' + baseTs,
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

    setSyncStatus('saving');
    try {
      await batchSyncLeadsToFirestore(newLeads);
      await syncImportedSheetToFirestore(sheetRecord);
      setLeads((prev) => [...newLeads, ...prev]);
      notifySaved(`${newLeads.length} leads importados e confirmados no Firestore.`);
    } catch (err) {
      notifySyncFailure('importação de planilha', err);
      throw err;
    }
  };

  // Handler: Create new niche AND import leads into it (awaited)
  const handleCreateNicheWithLeads = async (
    newNicheData: { name: string; segment: string; city: string; emoji: string },
    importedLeads: Omit<Lead, 'id' | 'nicheId' | 'createdAt' | 'notes'>[],
    sheetMetadata?: { name: string; format?: string; size?: number }
  ) => {
    const baseTs = Date.now();
    const newNicheId = 'niche-' + baseTs;
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
      id: `lead-imp-${baseTs}-${idx}`,
      nicheId: newNicheId,
      createdAt: new Date().toISOString(),
      notes: [
        {
          id: `note-imp-${baseTs}-${idx}`,
          date: new Date().toLocaleDateString('pt-BR'),
          text: 'Lead importado ao criar nova campanha.',
          author: userName,
        },
      ],
    }));

    const sheetRecord: ImportedSheet = {
      id: 'sheet-' + baseTs,
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

    setSyncStatus('saving');
    try {
      await syncNicheToFirestore(newNiche);
      await batchSyncLeadsToFirestore(newLeads);
      await syncImportedSheetToFirestore(sheetRecord);

      setNiches((prev) => [...prev, newNiche]);
      setLeads((prev) => [...newLeads, ...prev]);
      setActiveNicheId(newNicheId);
      notifySaved(`Campanha "${newNiche.name}" e ${newLeads.length} leads salvos no Firestore.`);
    } catch (err) {
      notifySyncFailure('criação de campanha e importação', err);
      throw err;
    }
  };

  // Handler: Delete imported sheet record
  const handleDeleteImportedSheet = async (sheetId: string) => {
    const previousSheets = importedSheets;
    setSyncStatus('saving');
    setImportedSheets((prev) => prev.filter((s) => s.id !== sheetId));

    try {
      await deleteImportedSheetFromFirestore(sheetId);
      notifySaved('Registro de planilha removido do histórico.');
    } catch (err) {
      setImportedSheets(previousSheets);
      notifySyncFailure('exclusão de histórico de planilha', err);
    }
  };

  // Handler: Update niche script templates
  const handleUpdateNicheScripts = async (updatedScripts: NicheCampaign['scripts']) => {
    if (!activeNiche) return;
    const previousNiches = niches;
    const updated = { ...activeNiche, scripts: updatedScripts };

    setSyncStatus('saving');
    setNiches((prev) => prev.map((n) => (n.id === activeNiche.id ? updated : n)));

    try {
      await syncNicheToFirestore(updated);
      notifySaved('Script salvo na nuvem.');
    } catch (err) {
      setNiches(previousNiches);
      notifySyncFailure('salvamento de scripts', err);
    }
  };

  // Handler: Update niche target prospecting cities
  const handleUpdateNicheTargetCities = async (targetCities: string[]) => {
    if (!activeNiche) return;
    const previousNiches = niches;
    const updated = { ...activeNiche, targetCities };

    setSyncStatus('saving');
    setNiches((prev) => prev.map((n) => (n.id === activeNiche.id ? updated : n)));

    try {
      await syncNicheToFirestore(updated);
      notifySaved();
    } catch (err) {
      setNiches(previousNiches);
      notifySyncFailure('atualização de cidades-alvo', err);
    }
  };

  // Handler: Safe, awaited backup restore (merges verified records preserving IDs)
  const handleRestoreBackup = async (payload: {
    niches: NicheCampaign[];
    leads: Lead[];
    importedSheets: ImportedSheet[];
    userName?: string;
  }) => {
    setSyncStatus('saving');
    try {
      await batchSyncNichesToFirestore(payload.niches);
      await batchSyncLeadsToFirestore(payload.leads);
      if (payload.importedSheets.length > 0) {
        await batchSyncImportedSheetsToFirestore(payload.importedSheets);
      }

      if (payload.userName) {
        setUserName(payload.userName);
      }
      notifySaved('Backup restaurado e confirmado no Firestore.');
    } catch (err) {
      notifySyncFailure('restauração de backup', err);
      throw err;
    }
  };

  // Handler: Logout via Firebase Authentication
  const handleLogout = async () => {
    await logoutFromFirebase();
    setIsAuthenticated(false);
    setSessionNotice(null);
  };

  // Handler: Explicit confirmed full clean baseline reset
  const handleClearAllContacts = async () => {
    setSyncStatus('saving');
    setIsCloudSynced(false);
    try {
      await resetFirestoreToCleanBaseline(INITIAL_NICHES);
      resetAllDataToCleanBaseline();
      setLeads([]);
      setImportedSheets([]);
      setNiches(INITIAL_NICHES);
      setActiveNicheId(INITIAL_NICHES[0].id);
      notifySaved('Banco de dados redefinido para o estado inicial limpo.');
    } catch (err) {
      notifySyncFailure('redefinição da base', err);
      throw err;
    }
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-300 text-xs">
        Verificando sessão autenticada...
      </div>
    );
  }

  if (!isAuthenticated || !authConfigValid) {
    return <LoginView sessionNotice={sessionNotice} authConfigValid={authConfigValid} />;
  }

  if (!activeNiche) {
    return (
      <div className="flex items-center justify-center min-h-screen text-xs text-slate-500">
        Carregando ProspectFlow...
      </div>
    );
  }

  return (
    <div className="h-screen h-dvh bg-slate-50 text-slate-900 flex flex-col font-sans w-full max-w-full overflow-hidden">
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
        allLeadsCount={leads.length}
        allNichesCount={niches.length}
        importedSheetsCount={importedSheets.length}
        lastBackupAt={loadLastBackupTimestamp()}
        meetingsCount={meetingLeadsCount}
        callbacksCount={todayCallbacksCount}
        onLogout={handleLogout}
        isCloudSynced={isCloudSynced}
        syncStatus={syncStatus}
        onClearAllContacts={handleClearAllContacts}
      />

      {/* Explicit Sync Error / Save Confirmation Alerts */}
      {syncError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-900 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1 font-medium">{syncError}</span>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {syncToast && !syncError && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-xs text-emerald-900 flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="flex-1">{syncToast}</span>
        </div>
      )}

      {/* Main Content Area based on Active Tab */}
      <main
        className={`flex-1 min-w-0 w-full max-w-full pb-14 md:pb-0 ${
          activeTab === 'kanban' ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-y-auto'
        }`}
      >
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
            importedSheets={importedSheets}
            userName={userName}
            onSelectNiche={(id) => {
              setActiveNicheId(id);
              setActiveTab('kanban');
            }}
            onOpenNewNicheModal={() => setIsNewNicheModalOpen(true)}
            onDeleteNiche={handleDeleteNiche}
            onRestoreBackup={handleRestoreBackup}
            onResetToCleanBaseline={handleClearAllContacts}
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
