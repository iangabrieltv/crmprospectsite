/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  AgendaEvent,
  Client,
  DocumentKind,
  Project,
  ProposalContract,
  ProposalStatus,
  SocialChannel,
  SocialPost,
  Task,
} from './types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialKind,
  FinancialPaymentMethod,
  FinancialRecurrence,
  FinancialRecurrenceFrequency,
  FinancialRecurrenceStatus,
  FinancialSettings,
  FinancialTransaction,
} from './types/finance';
import {
  CommercialScript,
  ModelTemplate,
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from './types/resources';
import { AnalyticsPreferences, SavedCustomReport } from './types/analytics';
import {
  AiConversation,
  AutomationExecutionLog,
  AutomationRuleSetting,
  SystemLogEntry,
  SystemLogLevel,
  SystemLogSource,
  SystemNotification,
  SystemSettings,
} from './types/system';
import {
  loadStoredNiches,
  saveStoredNiches,
  loadStoredLeads,
  saveStoredLeads,
  loadStoredClients,
  saveStoredClients,
  loadStoredProposals,
  saveStoredProposals,
  loadStoredProjects,
  saveStoredProjects,
  loadStoredTasks,
  saveStoredTasks,
  loadStoredAgendaEvents,
  saveStoredAgendaEvents,
  loadStoredSocialChannels,
  saveStoredSocialChannels,
  loadStoredSocialPosts,
  saveStoredSocialPosts,
  loadStoredFinancialEntries,
  saveStoredFinancialEntries,
  loadStoredFinancialTransactions,
  saveStoredFinancialTransactions,
  loadStoredFinancialCategories,
  saveStoredFinancialCategories,
  loadStoredFinancialRecurrences,
  saveStoredFinancialRecurrences,
  loadStoredFinancialSettings,
  saveStoredFinancialSettings,
  loadStoredFinancialAuditLogs,
  saveStoredFinancialAuditLogs,
  loadStoredResourceFiles,
  saveStoredResourceFiles,
  loadStoredResourceFolders,
  saveStoredResourceFolders,
  loadStoredResourceCategories,
  saveStoredResourceCategories,
  loadStoredCommercialScripts,
  saveStoredCommercialScripts,
  loadStoredModelTemplates,
  saveStoredModelTemplates,
  DEFAULT_ANALYTICS_PREFERENCES,
  loadStoredSavedCustomReports,
  saveStoredSavedCustomReports,
  loadStoredAnalyticsPreferences,
  saveStoredAnalyticsPreferences,
  loadStoredActiveNicheId,
  saveStoredActiveNicheId,
  loadStoredUserName,
  saveStoredUserName,
  loadStoredSystemSettings,
  saveStoredSystemSettings,
  loadStoredNotifications,
  saveStoredNotifications,
  loadStoredAutomationSettings,
  saveStoredAutomationSettings,
  loadStoredAutomationLogs,
  saveStoredAutomationLogs,
  loadStoredAiConversations,
  saveStoredAiConversations,
  loadStoredSystemLogs,
  saveStoredSystemLogs,
  loadLastBackupTimestamp,
  resetAllDataToCleanBaseline,
} from './utils/storage';
import {
  appendClientTimelineEvents,
  buildClientFromLead,
  findDuplicateClient,
  generateClientId,
  generateTimelineEventId,
  mergeClientWithProposalAcceptance,
} from './services/clientService';
import { appendProjectHistory } from './services/projectService';
import { generateProposalId, transitionProposalStatus } from './services/proposalService';
import {
  buildInitialCommercialScripts,
  buildInitialModelTemplates,
  ensureDefaultCategories,
  linkFileToSocialPost,
  linkFileToTask,
  unlinkFileFromSocialPost,
  unlinkFileFromTask,
} from './services/resources';
import {
  KAIZEN_TIMEZONE,
  BuildProposalFinancialInput,
  buildDefaultFinancialSettings,
  buildProposalFinancialForecast,
  cancelFinancialEntryRecord,
  changeRecurrenceStatus,
  createFinancialAuditLog,
  createFinancialCategory,
  createFinancialEntryRecord,
  createFinancialRecurrenceRecord,
  ensureDefaultFinancialCategories,
  generateDueRecurrenceEntries,
  getTodayInTimezone,
  registerSettlement,
  reverseTransaction,
  updateFinancialEntryRecord,
  updateFinancialRecurrenceRecord,
} from './services/finance';
import {
  buildDefaultAutomationRules,
  createSystemLogEntry,
  evaluateWorkspaceNotifications,
  fetchGeminiServerStatus,
  GeminiStatusProbe,
  mergeAutomationRulesWithDefaults,
  normalizeSystemSettings,
  runAutomationRules,
} from './services/system';
import { cleanPhoneForWhatsApp, formatDisplayPhone } from './utils/phone';
import { Header } from './components/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CrmSubNav } from './components/CrmSubNav';
import { KanbanView } from './components/KanbanView';
import { LeadsListView } from './components/LeadsListView';
import { AgendaView } from './components/AgendaView';
import { DashboardView } from './components/DashboardView';
import { ScriptsView } from './components/ScriptsView';
import { ImporterView } from './components/ImporterView';
import { ClientsView } from './components/ClientsView';
import { ProposalsView } from './components/ProposalsView';
import { ProjectsView } from './components/ProjectsView';
import { TasksView } from './components/TasksView';
import { SocialView } from './components/SocialView';
import { FinanceView } from './components/finance/FinanceView';
import { ResourcesCenterView, ResourcesSubTabId } from './components/resources/ResourcesCenterView';
import { AnalyticsHubView } from './components/analytics/AnalyticsHubView';
import { GlobalAgencyView, DeleteNicheChoice } from './components/GlobalAgencyView';
import { SettingsView } from './components/SettingsView';
import { AiAssistantView } from './components/assistant/AiAssistantView';
import { AutomationsView } from './components/automations/AutomationsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { LeadModal } from './components/LeadModal';
import { NewNicheModal } from './components/NewNicheModal';
import { NewLeadModal } from './components/NewLeadModal';
import { LoginView } from './components/LoginView';
import { Alert, Toast, Spinner } from './components/ui';
import { DEFAULT_SCRIPTS, INITIAL_NICHES, INITIAL_LEADS } from './utils/initialData';
import {
  testFirestoreConnection,
  isFirestorePermissionDeniedError,
  subscribeToNiches,
  subscribeToLeads,
  subscribeToImportedSheets,
  subscribeToClients,
  subscribeToProposals,
  subscribeToProjects,
  subscribeToTasks,
  subscribeToAgendaEvents,
  subscribeToSocialChannels,
  subscribeToSocialPosts,
  subscribeToFinancialEntries,
  subscribeToFinancialTransactions,
  subscribeToFinancialCategories,
  subscribeToFinancialRecurrences,
  subscribeToFinancialSettings,
  subscribeToFinancialAuditLogs,
  subscribeToResourceFiles,
  subscribeToResourceFolders,
  subscribeToResourceCategories,
  subscribeToCommercialScripts,
  subscribeToModelTemplates,
  syncLeadToFirestore,
  deleteLeadFromFirestore,
  batchSyncLeadsToFirestore,
  batchSyncNichesToFirestore,
  batchSyncImportedSheetsToFirestore,
  batchSyncClientsToFirestore,
  batchSyncProposalsToFirestore,
  batchSyncProjectsToFirestore,
  batchSyncTasksToFirestore,
  batchSyncAgendaEventsToFirestore,
  batchSyncSocialChannelsToFirestore,
  batchSyncSocialPostsToFirestore,
  syncClientToFirestore,
  deleteClientFromFirestore,
  syncProposalToFirestore,
  deleteProposalFromFirestore,
  syncProjectToFirestore,
  deleteProjectFromFirestore,
  syncTaskToFirestore,
  deleteTaskFromFirestore,
  syncAgendaEventToFirestore,
  deleteAgendaEventFromFirestore,
  syncSocialChannelToFirestore,
  deleteSocialChannelFromFirestore,
  syncSocialPostToFirestore,
  deleteSocialPostFromFirestore,
  syncFinancialEntryToFirestore,
  batchSyncFinancialEntriesToFirestore,
  syncFinancialTransactionToFirestore,
  batchSyncFinancialTransactionsToFirestore,
  syncFinancialCategoryToFirestore,
  batchSyncFinancialCategoriesToFirestore,
  syncFinancialRecurrenceToFirestore,
  batchSyncFinancialRecurrencesToFirestore,
  syncFinancialSettingsToFirestore,
  syncFinancialAuditLogToFirestore,
  batchSyncFinancialAuditLogsToFirestore,
  syncResourceFileToFirestore,
  deleteResourceFileFromFirestore,
  batchSyncResourceFilesToFirestore,
  syncResourceFolderToFirestore,
  deleteResourceFolderFromFirestore,
  batchSyncResourceFoldersToFirestore,
  syncResourceCategoryToFirestore,
  deleteResourceCategoryFromFirestore,
  batchSyncResourceCategoriesToFirestore,
  syncCommercialScriptToFirestore,
  deleteCommercialScriptFromFirestore,
  batchSyncCommercialScriptsToFirestore,
  syncModelTemplateToFirestore,
  batchSyncModelTemplatesToFirestore,
  subscribeToCustomReports,
  syncCustomReportToFirestore,
  deleteCustomReportFromFirestore,
  batchSyncCustomReportsToFirestore,
  subscribeToAnalyticsSettings,
  syncAnalyticsSettingsToFirestore,
  subscribeToSystemSettings,
  syncSystemSettingsToFirestore,
  subscribeToNotifications,
  syncNotificationToFirestore,
  batchSyncNotificationsToFirestore,
  subscribeToAutomationSettings,
  syncAutomationRuleToFirestore,
  batchSyncAutomationRulesToFirestore,
  subscribeToAutomationLogs,
  syncAutomationLogToFirestore,
  subscribeToAiConversations,
  syncAiConversationToFirestore,
  deleteAiConversationFromFirestore,
  subscribeToSystemLogs,
  syncSystemLogToFirestore,
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
  getActiveFirebaseIdToken,
  subscribeToAdminSession,
  logoutFromFirebase,
} from './services/authService';

export default function App() {
  // Real Firebase Authentication session gate (single authorized admin user)
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authConfigValid, setAuthConfigValid] = useState<boolean>(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [niches, setNiches] = useState<NicheCampaign[]>(() => loadStoredNiches());
  const [leads, setLeads] = useState<Lead[]>(() => loadStoredLeads());
  const [clients, setClients] = useState<Client[]>(() => loadStoredClients());
  const [proposals, setProposals] = useState<ProposalContract[]>(() => loadStoredProposals());
  const [projects, setProjects] = useState<Project[]>(() => loadStoredProjects());
  const [tasks, setTasks] = useState<Task[]>(() => loadStoredTasks());
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>(() =>
    loadStoredAgendaEvents()
  );
  const [socialChannels, setSocialChannels] = useState<SocialChannel[]>(() =>
    loadStoredSocialChannels()
  );
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>(() =>
    loadStoredSocialPosts()
  );
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>(() =>
    loadStoredFinancialEntries()
  );
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>(
    () => loadStoredFinancialTransactions()
  );
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>(() => {
    const stored = loadStoredFinancialCategories();
    const { categories } = ensureDefaultFinancialCategories(stored);
    if (categories.length !== stored.length) {
      saveStoredFinancialCategories(categories);
    }
    return categories;
  });
  const [financialRecurrences, setFinancialRecurrences] = useState<FinancialRecurrence[]>(() =>
    loadStoredFinancialRecurrences()
  );
  const [financialSettings, setFinancialSettings] = useState<FinancialSettings>(() => {
    const stored = loadStoredFinancialSettings();
    if (stored) return stored;
    const initial = buildDefaultFinancialSettings(getTodayInTimezone(KAIZEN_TIMEZONE));
    saveStoredFinancialSettings(initial);
    return initial;
  });
  const [financialAuditLogs, setFinancialAuditLogs] = useState<FinancialAuditLog[]>(() =>
    loadStoredFinancialAuditLogs()
  );
  const [resourceFiles, setResourceFiles] = useState<ResourceFile[]>(() =>
    loadStoredResourceFiles()
  );
  const [resourceFolders, setResourceFolders] = useState<ResourceFolder[]>(() =>
    loadStoredResourceFolders()
  );
  const [resourceCategories, setResourceCategories] = useState<ResourceCategory[]>(() => {
    const stored = loadStoredResourceCategories();
    const { categories: ensured } = ensureDefaultCategories(stored);
    if (ensured.length !== stored.length) {
      saveStoredResourceCategories(ensured);
    }
    return ensured;
  });
  const [commercialScripts, setCommercialScripts] = useState<CommercialScript[]>(() => {
    const stored = loadStoredCommercialScripts();
    if (stored.length > 0) return stored;
    const seeded = buildInitialCommercialScripts('Agência Kaizen');
    saveStoredCommercialScripts(seeded);
    return seeded;
  });
  const [modelTemplates, setModelTemplates] = useState<ModelTemplate[]>(() => {
    const stored = loadStoredModelTemplates();
    if (stored.length > 0) return stored;
    const seeded = buildInitialModelTemplates();
    saveStoredModelTemplates(seeded);
    return seeded;
  });
  const [savedCustomReports, setSavedCustomReports] = useState<SavedCustomReport[]>(() =>
    loadStoredSavedCustomReports()
  );
  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsPreferences>(() =>
    loadStoredAnalyticsPreferences()
  );
  const [importedSheets, setImportedSheets] = useState<ImportedSheet[]>([]);
  const [clientsCloudBlocked, setClientsCloudBlocked] = useState<boolean>(false);
  const [proposalsCloudBlocked, setProposalsCloudBlocked] = useState<boolean>(false);
  const [projectsCloudBlocked, setProjectsCloudBlocked] = useState<boolean>(false);
  const [tasksCloudBlocked, setTasksCloudBlocked] = useState<boolean>(false);
  const [agendaCloudBlocked, setAgendaCloudBlocked] = useState<boolean>(false);
  const [socialCloudBlocked, setSocialCloudBlocked] = useState<boolean>(false);
  const [financeCloudBlocked, setFinanceCloudBlocked] = useState<boolean>(false);
  const [resourcesCloudBlocked, setResourcesCloudBlocked] = useState<boolean>(false);
  const [analyticsCloudBlocked, setAnalyticsCloudBlocked] = useState<boolean>(false);
  const [systemCloudBlocked, setSystemCloudBlocked] = useState<boolean>(false);
  const [resourcesSubTabOverride, setResourcesSubTabOverride] =
    useState<ResourcesSubTabId | null>(null);
  const processingRecurrencesRef = useRef<boolean>(false);
  const [activeNicheId, setActiveNicheId] = useState<string>(() =>
    loadStoredActiveNicheId(niches[0]?.id || '')
  );
  const [userName, setUserName] = useState<string>(() => loadStoredUserName());
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() =>
    loadStoredSystemSettings(loadStoredUserName())
  );
  const [notifications, setNotifications] = useState<SystemNotification[]>(() =>
    loadStoredNotifications()
  );
  const [automationRules, setAutomationRules] = useState<AutomationRuleSetting[]>(() =>
    loadStoredAutomationSettings()
  );
  const [automationLogs, setAutomationLogs] = useState<AutomationExecutionLog[]>(() =>
    loadStoredAutomationLogs()
  );
  const [aiConversations, setAiConversations] = useState<AiConversation[]>(() =>
    loadStoredAiConversations()
  );
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>(() =>
    loadStoredSystemLogs()
  );
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatusProbe | null>(null);
  const notificationsRef = useRef<SystemNotification[]>(notifications);
  const autoRunOnOpenDoneRef = useRef<boolean>(false);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kaizen_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kaizen_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

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

    const unsubClients = subscribeToClients(
      (remoteClients) => {
        if (!active) return;
        setClientsCloudBlocked(false);
        if (remoteClients.length > 0) {
          setClients(remoteClients);
          saveStoredClients(remoteClients);
        } else {
          // Keep any unsynced local cache only if remote is empty? Once cloud is readable and empty, mirror cleanly if local has none
          setClients((prev) => {
            if (prev.length === 0) {
              saveStoredClients([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setClientsCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de clientes', err);
        }
      }
    );

    const unsubProposals = subscribeToProposals(
      (remoteProposals) => {
        if (!active) return;
        setProposalsCloudBlocked(false);
        if (remoteProposals.length > 0) {
          setProposals(remoteProposals);
          saveStoredProposals(remoteProposals);
        } else {
          setProposals((prev) => {
            if (prev.length === 0) {
              saveStoredProposals([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setProposalsCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de propostas', err);
        }
      }
    );

    const unsubProjects = subscribeToProjects(
      (remoteProjects) => {
        if (!active) return;
        setProjectsCloudBlocked(false);
        if (remoteProjects.length > 0) {
          setProjects(remoteProjects);
          saveStoredProjects(remoteProjects);
        } else {
          setProjects((prev) => {
            if (prev.length === 0) {
              saveStoredProjects([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setProjectsCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de projetos', err);
        }
      }
    );

    const unsubTasks = subscribeToTasks(
      (remoteTasks) => {
        if (!active) return;
        setTasksCloudBlocked(false);
        if (remoteTasks.length > 0) {
          setTasks(remoteTasks);
          saveStoredTasks(remoteTasks);
        } else {
          setTasks((prev) => {
            if (prev.length === 0) {
              saveStoredTasks([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setTasksCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de tarefas', err);
        }
      }
    );

    const unsubAgendaEvents = subscribeToAgendaEvents(
      (remoteEvents) => {
        if (!active) return;
        setAgendaCloudBlocked(false);
        if (remoteEvents.length > 0) {
          setAgendaEvents(remoteEvents);
          saveStoredAgendaEvents(remoteEvents);
        } else {
          setAgendaEvents((prev) => {
            if (prev.length === 0) {
              saveStoredAgendaEvents([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setAgendaCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de agenda', err);
        }
      }
    );

    const unsubSocialChannels = subscribeToSocialChannels(
      (remoteChannels) => {
        if (!active) return;
        setSocialCloudBlocked(false);
        if (remoteChannels.length > 0) {
          setSocialChannels(remoteChannels);
          saveStoredSocialChannels(remoteChannels);
        } else {
          setSocialChannels((prev) => {
            if (prev.length === 0) {
              saveStoredSocialChannels([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSocialCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de canais sociais', err);
        }
      }
    );

    const unsubSocialPosts = subscribeToSocialPosts(
      (remotePosts) => {
        if (!active) return;
        setSocialCloudBlocked(false);
        if (remotePosts.length > 0) {
          setSocialPosts(remotePosts);
          saveStoredSocialPosts(remotePosts);
        } else {
          setSocialPosts((prev) => {
            if (prev.length === 0) {
              saveStoredSocialPosts([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSocialCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de publicações sociais', err);
        }
      }
    );

    const unsubFinancialEntries = subscribeToFinancialEntries(
      (remoteEntries) => {
        if (!active) return;
        setFinanceCloudBlocked(false);
        if (remoteEntries.length > 0) {
          setFinancialEntries(remoteEntries);
          saveStoredFinancialEntries(remoteEntries);
        } else {
          setFinancialEntries((prev) => {
            if (prev.length === 0) {
              saveStoredFinancialEntries([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setFinanceCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de lançamentos financeiros', err);
        }
      }
    );

    const unsubFinancialTransactions = subscribeToFinancialTransactions(
      (remoteTxs) => {
        if (!active) return;
        setFinanceCloudBlocked(false);
        if (remoteTxs.length > 0) {
          setFinancialTransactions(remoteTxs);
          saveStoredFinancialTransactions(remoteTxs);
        } else {
          setFinancialTransactions((prev) => {
            if (prev.length === 0) {
              saveStoredFinancialTransactions([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setFinanceCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de movimentações financeiras', err);
        }
      }
    );

    const unsubFinancialCategories = subscribeToFinancialCategories(
      (remoteCats) => {
        if (!active) return;
        setFinanceCloudBlocked(false);
        if (remoteCats.length > 0) {
          const { categories } = ensureDefaultFinancialCategories(remoteCats);
          setFinancialCategories(categories);
          saveStoredFinancialCategories(categories);
        } else {
          const seeded = ensureDefaultFinancialCategories(loadStoredFinancialCategories());
          setFinancialCategories(seeded.categories);
          saveStoredFinancialCategories(seeded.categories);
          if (seeded.categories.length > 0) {
            batchSyncFinancialCategoriesToFirestore(seeded.categories).catch((err) => {
              if (isFirestorePermissionDeniedError(err)) {
                setFinanceCloudBlocked(true);
              }
            });
          }
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setFinanceCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de categorias financeiras', err);
        }
      }
    );

    const unsubFinancialRecurrences = subscribeToFinancialRecurrences(
      (remoteRecs) => {
        if (!active) return;
        setFinanceCloudBlocked(false);
        if (remoteRecs.length > 0) {
          setFinancialRecurrences(remoteRecs);
          saveStoredFinancialRecurrences(remoteRecs);
        } else {
          setFinancialRecurrences((prev) => {
            if (prev.length === 0) {
              saveStoredFinancialRecurrences([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setFinanceCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de recorrências financeiras', err);
        }
      }
    );

    const unsubFinancialSettings = subscribeToFinancialSettings(
      (remoteSettings) => {
        if (!active) return;
        setFinanceCloudBlocked(false);
        if (remoteSettings) {
          setFinancialSettings(remoteSettings);
          saveStoredFinancialSettings(remoteSettings);
        } else {
          const current =
            loadStoredFinancialSettings() ||
            buildDefaultFinancialSettings(getTodayInTimezone(KAIZEN_TIMEZONE));
          syncFinancialSettingsToFirestore(current).catch((err) => {
            if (isFirestorePermissionDeniedError(err)) {
              setFinanceCloudBlocked(true);
            }
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setFinanceCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de configurações financeiras', err);
        }
      }
    );

    const unsubFinancialAuditLogs = subscribeToFinancialAuditLogs(
      (remoteLogs) => {
        if (!active) return;
        setFinanceCloudBlocked(false);
        if (remoteLogs.length > 0) {
          setFinancialAuditLogs(remoteLogs);
          saveStoredFinancialAuditLogs(remoteLogs);
        } else {
          setFinancialAuditLogs((prev) => {
            if (prev.length === 0) {
              saveStoredFinancialAuditLogs([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setFinanceCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de histórico financeiro', err);
        }
      }
    );

    const unsubResourceFiles = subscribeToResourceFiles(
      (remoteFiles) => {
        if (!active) return;
        setResourcesCloudBlocked(false);
        if (remoteFiles.length > 0) {
          setResourceFiles(remoteFiles);
          saveStoredResourceFiles(remoteFiles);
        } else {
          setResourceFiles((prev) => {
            if (prev.length === 0) {
              saveStoredResourceFiles([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setResourcesCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de arquivos da central', err);
        }
      }
    );

    const unsubResourceFolders = subscribeToResourceFolders(
      (remoteFolders) => {
        if (!active) return;
        setResourcesCloudBlocked(false);
        if (remoteFolders.length > 0) {
          setResourceFolders(remoteFolders);
          saveStoredResourceFolders(remoteFolders);
        } else {
          setResourceFolders((prev) => {
            if (prev.length === 0) {
              saveStoredResourceFolders([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setResourcesCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de pastas da central', err);
        }
      }
    );

    const unsubResourceCategories = subscribeToResourceCategories(
      (remoteCats) => {
        if (!active) return;
        setResourcesCloudBlocked(false);
        if (remoteCats.length > 0) {
          const { categories: ensured } = ensureDefaultCategories(remoteCats);
          setResourceCategories(ensured);
          saveStoredResourceCategories(ensured);
        } else {
          const { categories: ensured } = ensureDefaultCategories(
            loadStoredResourceCategories()
          );
          setResourceCategories(ensured);
          saveStoredResourceCategories(ensured);
          if (ensured.length > 0) {
            batchSyncResourceCategoriesToFirestore(ensured).catch((err) => {
              if (isFirestorePermissionDeniedError(err)) {
                setResourcesCloudBlocked(true);
              }
            });
          }
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setResourcesCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de categorias da central', err);
        }
      }
    );

    const unsubCommercialScripts = subscribeToCommercialScripts(
      (remoteScripts) => {
        if (!active) return;
        setResourcesCloudBlocked(false);
        if (remoteScripts.length > 0) {
          setCommercialScripts(remoteScripts);
          saveStoredCommercialScripts(remoteScripts);
        } else {
          const stored = loadStoredCommercialScripts();
          const current =
            stored.length > 0 ? stored : buildInitialCommercialScripts('Agência Kaizen');
          setCommercialScripts(current);
          saveStoredCommercialScripts(current);
          if (current.length > 0) {
            batchSyncCommercialScriptsToFirestore(current).catch((err) => {
              if (isFirestorePermissionDeniedError(err)) {
                setResourcesCloudBlocked(true);
              }
            });
          }
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setResourcesCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de scripts comerciais', err);
        }
      }
    );

    const unsubModelTemplates = subscribeToModelTemplates(
      (remoteTemplates) => {
        if (!active) return;
        setResourcesCloudBlocked(false);
        if (remoteTemplates.length > 0) {
          setModelTemplates(remoteTemplates);
          saveStoredModelTemplates(remoteTemplates);
        } else {
          const stored = loadStoredModelTemplates();
          const current =
            stored.length > 0 ? stored : buildInitialModelTemplates();
          setModelTemplates(current);
          saveStoredModelTemplates(current);
          if (current.length > 0) {
            batchSyncModelTemplatesToFirestore(current).catch((err) => {
              if (isFirestorePermissionDeniedError(err)) {
                setResourcesCloudBlocked(true);
              }
            });
          }
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setResourcesCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de biblioteca de modelos', err);
        }
      }
    );

    const unsubCustomReports = subscribeToCustomReports(
      (remoteReports) => {
        if (!active) return;
        setAnalyticsCloudBlocked(false);
        if (remoteReports.length > 0) {
          setSavedCustomReports(remoteReports);
          saveStoredSavedCustomReports(remoteReports);
        } else {
          setSavedCustomReports((prev) => {
            if (prev.length === 0) {
              saveStoredSavedCustomReports([]);
              return [];
            }
            return prev;
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setAnalyticsCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de relatórios personalizados', err);
        }
      }
    );

    const unsubAnalyticsSettings = subscribeToAnalyticsSettings(
      (remoteSettings) => {
        if (!active) return;
        setAnalyticsCloudBlocked(false);
        if (remoteSettings) {
          setAnalyticsSettings(remoteSettings);
          saveStoredAnalyticsPreferences(remoteSettings);
        } else {
          const localPrefs = loadStoredAnalyticsPreferences() || DEFAULT_ANALYTICS_PREFERENCES;
          syncAnalyticsSettingsToFirestore(localPrefs).catch((err) => {
            if (isFirestorePermissionDeniedError(err)) {
              setAnalyticsCloudBlocked(true);
            }
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setAnalyticsCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de preferências de relatórios', err);
        }
      }
    );

    const unsubSystemSettings = subscribeToSystemSettings(
      (remoteSys) => {
        if (!active) return;
        setSystemCloudBlocked(false);
        if (remoteSys) {
          const normalized = normalizeSystemSettings(remoteSys, userName);
          setSystemSettings(normalized);
          saveStoredSystemSettings(normalized);
          if (normalized.adminProfile.displayName) {
            setUserName(normalized.adminProfile.displayName);
          }
        } else {
          const localSys = loadStoredSystemSettings(userName);
          syncSystemSettingsToFirestore(localSys).catch((err) => {
            if (isFirestorePermissionDeniedError(err)) {
              setSystemCloudBlocked(true);
            }
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de configurações do sistema', err);
        }
      }
    );

    const unsubNotifications = subscribeToNotifications(
      (remoteNotifications) => {
        if (!active) return;
        setSystemCloudBlocked(false);
        if (remoteNotifications.length > 0) {
          setNotifications(remoteNotifications);
          notificationsRef.current = remoteNotifications;
          saveStoredNotifications(remoteNotifications);
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de notificações', err);
        }
      }
    );

    const unsubAutomationSettings = subscribeToAutomationSettings(
      (remoteRules) => {
        if (!active) return;
        setSystemCloudBlocked(false);
        if (remoteRules.length > 0) {
          const merged = mergeAutomationRulesWithDefaults(remoteRules);
          setAutomationRules(merged);
          saveStoredAutomationSettings(merged);
        } else {
          const defaults = buildDefaultAutomationRules();
          batchSyncAutomationRulesToFirestore(defaults).catch((err) => {
            if (isFirestorePermissionDeniedError(err)) {
              setSystemCloudBlocked(true);
            }
          });
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de automações', err);
        }
      }
    );

    const unsubAutomationLogs = subscribeToAutomationLogs(
      (remoteLogs) => {
        if (!active) return;
        setSystemCloudBlocked(false);
        if (remoteLogs.length > 0) {
          setAutomationLogs(remoteLogs.slice(0, 120));
          saveStoredAutomationLogs(remoteLogs);
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de histórico de automações', err);
        }
      }
    );

    const unsubAiConversations = subscribeToAiConversations(
      (remoteConvs) => {
        if (!active) return;
        setSystemCloudBlocked(false);
        setAiConversations(remoteConvs);
        saveStoredAiConversations(remoteConvs);
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de conversas do Assistente IA', err);
        }
      }
    );

    const unsubSystemLogs = subscribeToSystemLogs(
      (remoteSysLogs) => {
        if (!active) return;
        setSystemCloudBlocked(false);
        if (remoteSysLogs.length > 0) {
          setSystemLogs(remoteSysLogs.slice(0, 150));
          saveStoredSystemLogs(remoteSysLogs);
        }
      },
      (err) => {
        if (!active) return;
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        } else {
          notifySyncFailure('leitura de logs do sistema', err);
        }
      }
    );

    return () => {
      active = false;
      unsubNiches();
      unsubLeads();
      unsubSheets();
      unsubClients();
      unsubProposals();
      unsubProjects();
      unsubTasks();
      unsubAgendaEvents();
      unsubSocialChannels();
      unsubSocialPosts();
      unsubFinancialEntries();
      unsubFinancialTransactions();
      unsubFinancialCategories();
      unsubFinancialRecurrences();
      unsubFinancialSettings();
      unsubFinancialAuditLogs();
      unsubResourceFiles();
      unsubResourceFolders();
      unsubResourceCategories();
      unsubCommercialScripts();
      unsubModelTemplates();
      unsubCustomReports();
      unsubAnalyticsSettings();
      unsubSystemSettings();
      unsubNotifications();
      unsubAutomationSettings();
      unsubAutomationLogs();
      unsubAiConversations();
      unsubSystemLogs();
    };
  }, [authReady, isAuthenticated, authConfigValid, notifySyncFailure]);

  // Modal & cross-navigation states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [externalSelectedClientId, setExternalSelectedClientId] = useState<string | null>(null);
  const [externalSelectedProjectId, setExternalSelectedProjectId] = useState<string | null>(null);
  const [initialClientIdForNewProject, setInitialClientIdForNewProject] = useState<string | null>(
    null
  );
  const [initialNewEventClientId, setInitialNewEventClientId] = useState<string | null>(null);
  const [proposalDraftSource, setProposalDraftSource] = useState<{
    client?: Client | null;
    lead?: Lead | null;
    kind?: DocumentKind;
  } | null>(null);
  const [externalPreviewProposalId, setExternalPreviewProposalId] = useState<string | null>(null);
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

  const meetingLeadsCount = leads.filter(
    (l) =>
      l.stage === 'reuniao_marcada' &&
      l.meetingStatus !== 'realizada' &&
      l.meetingStatus !== 'cancelada'
  ).length;
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayCallbacksCount = leads.filter(
    (l) =>
      l.callbackDate &&
      l.callbackDate <= todayDateStr &&
      l.callbackStatus !== 'realizado' &&
      l.callbackStatus !== 'cancelado'
  ).length;
  const dueAgendaEventsCount = agendaEvents.filter(
    (e) => e.status === 'agendado' && e.date <= todayDateStr
  ).length;
  const dueTasksCount = tasks.filter(
    (t) => t.status !== 'concluida' && Boolean(t.dueDate) && (t.dueDate as string) <= todayDateStr
  ).length;

  // Local cache mirror
  useEffect(() => {
    if (activeNiche?.id) {
      saveStoredActiveNicheId(activeNiche.id);
    }
  }, [activeNiche?.id]);

  // Keep notificationsRef in sync
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Gemini server status probe
  const handleRefreshGeminiStatus = useCallback(async () => {
    const token = await getActiveFirebaseIdToken();
    const probe = await fetchGeminiServerStatus(token);
    setGeminiStatus(probe);
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !authConfigValid) return;
    handleRefreshGeminiStatus();
  }, [authReady, isAuthenticated, authConfigValid, handleRefreshGeminiStatus]);

  // Sanitized system log recorder
  const appendSystemLog = useCallback(
    async (level: SystemLogLevel, source: SystemLogSource, title: string, message: string) => {
      const entry = createSystemLogEntry({ level, source, title, message });
      setSystemLogs((prev) => {
        const next = [entry, ...prev].slice(0, 150);
        saveStoredSystemLogs(next);
        return next;
      });
      if (!systemCloudBlocked && authReady && isAuthenticated) {
        try {
          await syncSystemLogToFirestore(entry);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSystemCloudBlocked(true);
          }
        }
      }
    },
    [systemCloudBlocked, authReady, isAuthenticated]
  );

  // Deduplicated Notification Center evaluation from real workspace entities
  useEffect(() => {
    if (!authReady || !isAuthenticated || !authConfigValid) return;
    const { notifications: evaluated, changedNotifications } = evaluateWorkspaceNotifications({
      leads,
      proposals,
      projects,
      tasks,
      agendaEvents,
      financialEntries,
      existingNotifications: notificationsRef.current,
      settings: systemSettings,
      financialAlertDaysAhead: financialSettings.alertDaysAhead ?? 5,
    });

    if (changedNotifications.length > 0) {
      notificationsRef.current = evaluated;
      setNotifications(evaluated);
      saveStoredNotifications(evaluated);
      if (!systemCloudBlocked) {
        batchSyncNotificationsToFirestore(changedNotifications).catch((err) => {
          if (isFirestorePermissionDeniedError(err)) {
            setSystemCloudBlocked(true);
          }
        });
      }
    }
  }, [
    authReady,
    isAuthenticated,
    authConfigValid,
    leads,
    proposals,
    projects,
    tasks,
    agendaEvents,
    financialEntries,
    financialSettings.alertDaysAhead,
    systemSettings,
    systemCloudBlocked,
  ]);

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

  // Handler: Save or update a Client (writes locally immediately + syncs to Firestore)
  const handleSaveClient = async (client: Client, mode: 'create' | 'edit') => {
    setClients((prev) => {
      const next =
        mode === 'create'
          ? [client, ...prev.filter((c) => c.id !== client.id)]
          : prev.map((c) => (c.id === client.id ? client : c));
      saveStoredClients(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncClientToFirestore(client);
      setClientsCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Cliente "${client.companyName}" cadastrado e salvo.`
          : `Ficha de "${client.companyName}" atualizada.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setClientsCloudBlocked(true);
        notifySaved(
          `Cliente "${client.companyName}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de cliente', err);
      }
    }
  };

  // Handler: Delete a Client (preserves CRM lead origin untouched)
  const handleDeleteClient = async (clientId: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== clientId);
      saveStoredClients(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteClientFromFirestore(clientId);
      setClientsCloudBlocked(false);
      notifySaved('Cliente removido.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setClientsCloudBlocked(true);
        notifySaved('Cliente removido localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de cliente', err);
      }
    }
  };

  // Handler: Convert a CRM Lead into a Client without duplication or history loss
  const handleConvertLeadToClient = async (lead: Lead): Promise<Client> => {
    const dup = findDuplicateClient(clients, {
      originLeadId: lead.id,
      phone: lead.phone,
      companyName: lead.companyName,
    });
    if (dup) {
      setExternalSelectedClientId(dup.existingClient.id);
      setActiveTab('clients');
      return dup.existingClient;
    }

    const nicheMatch = niches.find((n) => n.id === lead.nicheId);
    const createdClient = buildClientFromLead(lead, nicheMatch, userName);
    await handleSaveClient(createdClient, 'create');

    if (normalizeStageId(lead.stage) !== 'fechado') {
      const updatedLead: Lead = {
        ...lead,
        stage: 'fechado',
        notes: [
          {
            id: `note-conv-${Date.now()}`,
            date: new Date().toLocaleDateString('pt-BR'),
            text: `Lead convertido em cliente no Kaizen (${createdClient.id}).`,
            author: userName,
          },
          ...(lead.notes || []),
        ],
      };
      await handleUpdateLead(updatedLead);
    }

    return createdClient;
  };

  // Handler: Save or update Proposal / Contract
  const handleSaveProposal = async (
    proposal: ProposalContract,
    mode: 'create' | 'edit'
  ) => {
    setProposals((prev) => {
      const next =
        mode === 'create'
          ? [proposal, ...prev.filter((p) => p.id !== proposal.id)]
          : prev.map((p) => (p.id === proposal.id ? proposal : p));
      saveStoredProposals(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncProposalToFirestore(proposal);
      setProposalsCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `${proposal.code} criada com sucesso.`
          : `${proposal.code} atualizada.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setProposalsCloudBlocked(true);
        notifySaved(
          `${proposal.code} salva localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de proposta/contrato', err);
      }
    }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    setProposals((prev) => {
      const next = prev.filter((p) => p.id !== proposalId);
      saveStoredProposals(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteProposalFromFirestore(proposalId);
      setProposalsCloudBlocked(false);
      notifySaved('Documento removido.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setProposalsCloudBlocked(true);
        notifySaved('Documento removido localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de proposta', err);
      }
    }
  };

  const handleTransitionProposalStatus = async (
    proposal: ProposalContract,
    nextStatus: ProposalStatus,
    note?: string
  ) => {
    const updated = transitionProposalStatus(proposal, nextStatus, userName, note);
    await handleSaveProposal(updated, 'edit');
  };

  // Handler: Approve Proposal and create/merge Client automatically without duplicates
  const handleApproveProposalAndSyncClient = async (
    proposal: ProposalContract
  ): Promise<Client> => {
    const nowIso = new Date().toISOString();
    const acceptedProposal =
      proposal.status === 'aprovada' || proposal.status === 'assinada'
        ? proposal
        : transitionProposalStatus(
            proposal,
            'aprovada',
            userName,
            'Aprovada e sincronizada com a carteira de clientes.'
          );

    const existingMatch =
      (acceptedProposal.clientId
        ? clients.find((c) => c.id === acceptedProposal.clientId)
        : undefined) ||
      findDuplicateClient(clients, {
        originLeadId: acceptedProposal.leadId,
        phone: acceptedProposal.recipientPhone,
        companyName: acceptedProposal.recipientCompany,
      })?.existingClient;

    let syncedClient: Client;

    if (existingMatch) {
      syncedClient = mergeClientWithProposalAcceptance(
        existingMatch,
        acceptedProposal,
        userName
      );
      await handleSaveClient(syncedClient, 'edit');
    } else {
      const linkedLead = acceptedProposal.leadId
        ? leads.find((l) => l.id === acceptedProposal.leadId)
        : undefined;

      if (linkedLead) {
        const nicheMatch = niches.find((n) => n.id === linkedLead.nicheId);
        syncedClient = buildClientFromLead(linkedLead, nicheMatch, userName, {
          status: 'ativo',
          setupValue: acceptedProposal.setupTotal,
          monthlyMrr: acceptedProposal.monthlyMrr,
          proposalCode: acceptedProposal.code,
        });
        await handleSaveClient(syncedClient, 'create');

        if (normalizeStageId(linkedLead.stage) !== 'fechado') {
          await handleUpdateLead({
            ...linkedLead,
            stage: 'fechado',
            creationValue: acceptedProposal.setupTotal || linkedLead.creationValue,
            monthlyMrr: acceptedProposal.monthlyMrr || linkedLead.monthlyMrr,
            notes: [
              {
                id: `note-prop-${Date.now()}`,
                date: new Date().toLocaleDateString('pt-BR'),
                text: `Fechado via aprovação do documento ${acceptedProposal.code}.`,
                author: userName,
              },
              ...(linkedLead.notes || []),
            ],
          });
        }
      } else {
        const cleanPhone = cleanPhoneForWhatsApp(
          acceptedProposal.recipientPhone || ''
        );
        syncedClient = {
          id: generateClientId(),
          companyName: acceptedProposal.recipientCompany,
          contactName: acceptedProposal.recipientContact,
          document: acceptedProposal.recipientDocument,
          email: acceptedProposal.recipientEmail,
          phone: cleanPhone,
          displayPhone: cleanPhone ? formatDisplayPhone(cleanPhone) : '',
          city: acceptedProposal.recipientCity,
          status: 'ativo',
          setupValue: acceptedProposal.setupTotal,
          monthlyMrr: acceptedProposal.monthlyMrr,
          billingDay: 10,
          contractStartDate: nowIso.slice(0, 10),
          serviceScope: acceptedProposal.title,
          timeline: [
            {
              id: generateTimelineEventId('prop'),
              date: nowIso,
              type: 'proposta_vinculada',
              title: `Cliente criado a partir de ${acceptedProposal.code}`,
              description: `${acceptedProposal.title} · Setup R$ ${acceptedProposal.setupTotal.toLocaleString(
                'pt-BR'
              )} · MRR R$ ${acceptedProposal.monthlyMrr.toLocaleString('pt-BR')}/mês`,
              author: userName,
            },
          ],
          createdAt: nowIso,
          schemaVersion: 1,
          updatedAt: nowIso,
        };
        await handleSaveClient(syncedClient, 'create');
      }
    }

    const linkedProposal: ProposalContract = {
      ...acceptedProposal,
      clientId: syncedClient.id,
      updatedAt: nowIso,
    };
    await handleSaveProposal(linkedProposal, 'edit');

    return syncedClient;
  };

  // Handler: Create Project + initial template Tasks (also records timeline in linked Client)
  const handleCreateProjectWithTasks = async (
    project: Project,
    initialTasks: Task[]
  ) => {
    setProjects((prev) => {
      const next = [project, ...prev.filter((p) => p.id !== project.id)];
      saveStoredProjects(next);
      return next;
    });

    if (initialTasks.length > 0) {
      setTasks((prev) => {
        const next = [...initialTasks, ...prev];
        saveStoredTasks(next);
        return next;
      });
    }

    if (project.clientId) {
      const targetClient = clients.find((c) => c.id === project.clientId);
      if (targetClient) {
        const updatedClient: Client = {
          ...targetClient,
          timeline: appendClientTimelineEvents(targetClient.timeline || [], [
            {
              id: generateTimelineEventId('prj'),
              date: new Date().toISOString(),
              type: 'projeto_vinculado',
              title: `Projeto iniciado: ${project.name}`,
              description: `${project.serviceType}${
                initialTasks.length > 0 ? ` · ${initialTasks.length} tarefas iniciais` : ''
              }`,
              author: userName,
            },
          ]),
          updatedAt: new Date().toISOString(),
        };
        await handleSaveClient(updatedClient, 'edit');
      }
    }

    setSyncStatus('saving');
    try {
      await syncProjectToFirestore(project);
      if (initialTasks.length > 0) {
        await batchSyncTasksToFirestore(initialTasks);
      }
      setProjectsCloudBlocked(false);
      setTasksCloudBlocked(false);
      notifySaved(
        initialTasks.length > 0
          ? `Projeto "${project.name}" e ${initialTasks.length} tarefas criados.`
          : `Projeto "${project.name}" criado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setProjectsCloudBlocked(true);
        setTasksCloudBlocked(true);
        notifySaved(
          `Projeto "${project.name}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('criação de projeto', err);
      }
    }
  };

  const handleUpdateProject = async (project: Project) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === project.id ? project : p));
      saveStoredProjects(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncProjectToFirestore(project);
      setProjectsCloudBlocked(false);
      notifySaved(`Projeto "${project.name}" atualizado.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setProjectsCloudBlocked(true);
        notifySaved(
          `Projeto "${project.name}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('atualização de projeto', err);
      }
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const linkedTasks = tasks.filter((t) => t.projectId === projectId);

    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      saveStoredProjects(next);
      return next;
    });
    if (linkedTasks.length > 0) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.projectId !== projectId);
        saveStoredTasks(next);
        return next;
      });
    }

    setSyncStatus('saving');
    try {
      await deleteProjectFromFirestore(projectId);
      for (const lt of linkedTasks) {
        await deleteTaskFromFirestore(lt.id);
      }
      setProjectsCloudBlocked(false);
      notifySaved('Projeto e tarefas vinculadas removidos.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setProjectsCloudBlocked(true);
        setTasksCloudBlocked(true);
        notifySaved('Projeto removido localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de projeto', err);
      }
    }
  };

  // Handler: Tasks CRUD (updates linked Project history on task completion WITHOUT auto-completing project)
  const handleSaveTask = async (task: Task, mode: 'create' | 'edit') => {
    const previousTask = mode === 'edit' ? tasks.find((t) => t.id === task.id) : undefined;

    setTasks((prev) => {
      const next =
        mode === 'create'
          ? [task, ...prev.filter((t) => t.id !== task.id)]
          : prev.map((t) => (t.id === task.id ? task : t));
      saveStoredTasks(next);
      return next;
    });

    // When a linked task transitions to 'concluida', append history to Project (never auto-completes project)
    if (
      task.projectId &&
      task.status === 'concluida' &&
      previousTask?.status !== 'concluida'
    ) {
      const targetProject = projects.find((p) => p.id === task.projectId);
      if (targetProject) {
        const updatedProject = appendProjectHistory(targetProject, {
          type: 'tarefa_concluida',
          title: `Tarefa concluída: ${task.title}`,
          author: userName,
        });
        await handleUpdateProject(updatedProject);
      }
    }

    setSyncStatus('saving');
    try {
      await syncTaskToFirestore(task);
      setTasksCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Tarefa "${task.title}" criada.`
          : `Tarefa "${task.title}" atualizada.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setTasksCloudBlocked(true);
        notifySaved(
          `Tarefa "${task.title}" salva localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de tarefa', err);
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      saveStoredTasks(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteTaskFromFirestore(taskId);
      setTasksCloudBlocked(false);
      notifySaved('Tarefa excluída.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setTasksCloudBlocked(true);
        notifySaved('Tarefa excluída localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de tarefa', err);
      }
    }
  };

  // Handler: Integrated Agenda Events CRUD (auto-logs client meetings in Client.timeline)
  const handleSaveAgendaEvent = async (
    event: AgendaEvent,
    mode: 'create' | 'edit'
  ) => {
    setAgendaEvents((prev) => {
      const next =
        mode === 'create'
          ? [event, ...prev.filter((e) => e.id !== event.id)]
          : prev.map((e) => (e.id === event.id ? event : e));
      saveStoredAgendaEvents(next);
      return next;
    });

    if (mode === 'create' && event.clientId) {
      const targetClient = clients.find((c) => c.id === event.clientId);
      if (targetClient) {
        const updatedClient: Client = {
          ...targetClient,
          timeline: appendClientTimelineEvents(targetClient.timeline || [], [
            {
              id: generateTimelineEventId('ag'),
              date: new Date().toISOString(),
              type: 'reuniao_agendada',
              title: `Compromisso agendado: ${event.title}`,
              description: `${event.date.split('-').reverse().join('/')}${
                event.startTime ? ` às ${event.startTime}` : ''
              }${event.description ? ` · ${event.description}` : ''}`,
              author: userName,
            },
          ]),
          updatedAt: new Date().toISOString(),
        };
        await handleSaveClient(updatedClient, 'edit');
      }
    }

    setSyncStatus('saving');
    try {
      await syncAgendaEventToFirestore(event);
      setAgendaCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Compromisso "${event.title}" adicionado à Agenda.`
          : `Compromisso "${event.title}" atualizado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setAgendaCloudBlocked(true);
        notifySaved(
          `Compromisso "${event.title}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento na agenda', err);
      }
    }
  };

  const handleDeleteAgendaEvent = async (eventId: string) => {
    setAgendaEvents((prev) => {
      const next = prev.filter((e) => e.id !== eventId);
      saveStoredAgendaEvents(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteAgendaEventFromFirestore(eventId);
      setAgendaCloudBlocked(false);
      notifySaved('Compromisso removido da Agenda.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setAgendaCloudBlocked(true);
        notifySaved('Compromisso removido localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão na agenda', err);
      }
    }
  };

  // Handler: Social Media Channels & Editorial Posts CRUD
  const handleSaveSocialChannel = async (
    channel: SocialChannel,
    mode: 'create' | 'edit'
  ) => {
    setSocialChannels((prev) => {
      const next =
        mode === 'create'
          ? [channel, ...prev.filter((c) => c.id !== channel.id)]
          : prev.map((c) => (c.id === channel.id ? channel : c));
      saveStoredSocialChannels(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncSocialChannelToFirestore(channel);
      setSocialCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Canal "${channel.handle}" cadastrado.`
          : `Canal "${channel.handle}" atualizado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSocialCloudBlocked(true);
        notifySaved(
          `Canal "${channel.handle}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de canal social', err);
      }
    }
  };

  const handleDeleteSocialChannel = async (channelId: string) => {
    setSocialChannels((prev) => {
      const next = prev.filter((c) => c.id !== channelId);
      saveStoredSocialChannels(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteSocialChannelFromFirestore(channelId);
      setSocialCloudBlocked(false);
      notifySaved('Canal removido.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSocialCloudBlocked(true);
        notifySaved('Canal removido localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de canal social', err);
      }
    }
  };

  const handleSaveSocialPost = async (
    post: SocialPost,
    mode: 'create' | 'edit'
  ) => {
    setSocialPosts((prev) => {
      const next =
        mode === 'create'
          ? [post, ...prev.filter((p) => p.id !== post.id)]
          : prev.map((p) => (p.id === post.id ? post : p));
      saveStoredSocialPosts(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncSocialPostToFirestore(post);
      setSocialCloudBlocked(false);
      notifySaved(
        post.status === 'publicado'
          ? `Publicação "${post.title}" confirmada como publicada.`
          : mode === 'create'
          ? `Conteúdo "${post.title}" adicionado ao calendário.`
          : `Conteúdo "${post.title}" atualizado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSocialCloudBlocked(true);
        notifySaved(
          `Conteúdo "${post.title}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de publicação social', err);
      }
    }
  };

  const handleDeleteSocialPost = async (postId: string) => {
    setSocialPosts((prev) => {
      const next = prev.filter((p) => p.id !== postId);
      saveStoredSocialPosts(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteSocialPostFromFirestore(postId);
      setSocialCloudBlocked(false);
      notifySaved('Publicação excluída.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSocialCloudBlocked(true);
        notifySaved('Publicação removida localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de publicação social', err);
      }
    }
  };

  // Handler: Financial Entries, Settlements, Reversals, Recurrences, Categories, Settings & Forecasts
  const appendAuditLogsLocally = useCallback((logs: FinancialAuditLog[]) => {
    if (logs.length === 0) return;
    setFinancialAuditLogs((prev) => {
      const next = [...logs, ...prev];
      saveStoredFinancialAuditLogs(next);
      return next;
    });
  }, []);

  const handleSaveFinancialEntry = async (payload: {
    id?: string;
    kind: FinancialKind;
    description: string;
    clientId?: string;
    supplierName?: string;
    serviceName?: string;
    projectId?: string;
    proposalId?: string;
    contractCode?: string;
    categoryId: string;
    amountCents: number;
    competenceDate: string;
    dueDate: string;
    paymentMethod: FinancialPaymentMethod;
    initialStatus: 'prevista' | 'pendente';
    attachmentUrl?: string;
    notes?: string;
  }) => {
    const existing = payload.id
      ? financialEntries.find((e) => e.id === payload.id)
      : undefined;

    const { entry, auditLog } = existing
      ? updateFinancialEntryRecord(
          existing,
          {
            description: payload.description,
            clientId: payload.clientId,
            supplierName: payload.supplierName,
            serviceName: payload.serviceName,
            projectId: payload.projectId,
            proposalId: payload.proposalId,
            contractCode: payload.contractCode,
            categoryId: payload.categoryId,
            amountCents: payload.amountCents,
            competenceDate: payload.competenceDate,
            dueDate: payload.dueDate,
            paymentMethod: payload.paymentMethod,
            status: payload.initialStatus,
            attachmentUrl: payload.attachmentUrl,
            notes: payload.notes,
          },
          userName
        )
      : createFinancialEntryRecord(payload, userName);

    setFinancialEntries((prev) => {
      const next = existing
        ? prev.map((e) => (e.id === entry.id ? entry : e))
        : [entry, ...prev.filter((e) => e.id !== entry.id)];
      saveStoredFinancialEntries(next);
      return next;
    });
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialEntryToFirestore(entry);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved(
        existing
          ? `Lançamento "${entry.description}" atualizado.`
          : `Lançamento "${entry.description}" criado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved(
          `Lançamento "${entry.description}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de lançamento financeiro', err);
      }
    }
  };

  const handleCancelFinancialEntry = async (entry: FinancialEntry, reason: string) => {
    const { entry: updatedEntry, auditLog } = cancelFinancialEntryRecord(
      entry,
      reason,
      userName
    );
    setFinancialEntries((prev) => {
      const next = prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
      saveStoredFinancialEntries(next);
      return next;
    });
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialEntryToFirestore(updatedEntry);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved(`Lançamento "${updatedEntry.description}" cancelado.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved('Cancelamento registrado localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('cancelamento financeiro', err);
      }
    }
  };

  const handleSettleFinancialEntry = async (params: {
    entry: FinancialEntry;
    amountCents: number;
    date: string;
    paymentMethod: FinancialPaymentMethod;
    adjustmentCents?: number;
    notes?: string;
  }) => {
    const { updatedEntry, createdTransactions, auditLogs } = registerSettlement({
      ...params,
      existingTransactions: financialTransactions,
      actor: userName,
    });

    setFinancialEntries((prev) => {
      const next = prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
      saveStoredFinancialEntries(next);
      return next;
    });
    setFinancialTransactions((prev) => {
      const next = [...createdTransactions, ...prev];
      saveStoredFinancialTransactions(next);
      return next;
    });
    appendAuditLogsLocally(auditLogs);

    setSyncStatus('saving');
    try {
      await syncFinancialEntryToFirestore(updatedEntry);
      await batchSyncFinancialTransactionsToFirestore(createdTransactions);
      await batchSyncFinancialAuditLogsToFirestore(auditLogs);
      setFinanceCloudBlocked(false);
      notifySaved(`Movimentação financeira confirmada em "${updatedEntry.description}".`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved('Movimentação salva localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('baixa financeira', err);
      }
    }
  };

  const handleReverseFinancialTransaction = async (params: {
    entry: FinancialEntry;
    transaction: FinancialTransaction;
    reason: string;
    date: string;
  }) => {
    const { updatedEntry, reversalTransaction, auditLog } = reverseTransaction({
      ...params,
      existingTransactions: financialTransactions,
      actor: userName,
    });

    setFinancialEntries((prev) => {
      const next = prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
      saveStoredFinancialEntries(next);
      return next;
    });
    setFinancialTransactions((prev) => {
      const next = [reversalTransaction, ...prev];
      saveStoredFinancialTransactions(next);
      return next;
    });
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialEntryToFirestore(updatedEntry);
      await syncFinancialTransactionToFirestore(reversalTransaction);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved(`Estorno registrado para "${updatedEntry.description}".`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved('Estorno salvo localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('estorno financeiro', err);
      }
    }
  };

  const handleSaveFinancialRecurrence = async (payload: {
    editingId?: string;
    name: string;
    kind: FinancialKind;
    amountCents: number;
    categoryId: string;
    clientId?: string;
    supplierName?: string;
    serviceName?: string;
    projectId?: string;
    paymentMethod: FinancialPaymentMethod;
    frequency: FinancialRecurrenceFrequency;
    customIntervalDays?: number;
    startDate: string;
    endDate?: string;
    notes?: string;
  }) => {
    const existing = payload.editingId
      ? financialRecurrences.find((r) => r.id === payload.editingId)
      : undefined;

    const { recurrence, auditLog } = existing
      ? updateFinancialRecurrenceRecord(existing, payload, userName)
      : createFinancialRecurrenceRecord(payload, userName);

    setFinancialRecurrences((prev) => {
      const next = existing
        ? prev.map((r) => (r.id === recurrence.id ? recurrence : r))
        : [recurrence, ...prev];
      saveStoredFinancialRecurrences(next);
      return next;
    });
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialRecurrenceToFirestore(recurrence);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved(
        existing
          ? `Recorrência "${recurrence.name}" atualizada.`
          : `Recorrência "${recurrence.name}" criada.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved('Recorrência salva localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('salvamento de recorrência', err);
      }
    }
  };

  const handleChangeFinancialRecurrenceStatus = async (
    rec: FinancialRecurrence,
    status: FinancialRecurrenceStatus
  ) => {
    const { recurrence, auditLog } = changeRecurrenceStatus(rec, status, userName);
    setFinancialRecurrences((prev) => {
      const next = prev.map((r) => (r.id === recurrence.id ? recurrence : r));
      saveStoredFinancialRecurrences(next);
      return next;
    });
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialRecurrenceToFirestore(recurrence);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved(`Recorrência "${recurrence.name}" atualizada para ${status}.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved('Status salvo localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('status de recorrência', err);
      }
    }
  };

  const runDueRecurrencesCheck = useCallback(
    async (
      sourceRecurrences: FinancialRecurrence[],
      sourceEntries: FinancialEntry[],
      silent: boolean
    ): Promise<number> => {
      if (processingRecurrencesRef.current) return 0;
      processingRecurrencesRef.current = true;
      try {
        const referenceDate = getTodayInTimezone(
          financialSettings.timezone || KAIZEN_TIMEZONE
        );
        const { createdEntries, updatedRecurrences, auditLogs } =
          generateDueRecurrenceEntries({
            recurrences: sourceRecurrences,
            existingEntries: sourceEntries,
            referenceDate,
            actor: userName,
          });

        if (createdEntries.length === 0 && updatedRecurrences.length === 0) {
          return 0;
        }

        if (createdEntries.length > 0) {
          setFinancialEntries((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const uniqueNew = createdEntries.filter((e) => !existingIds.has(e.id));
            if (uniqueNew.length === 0) return prev;
            const next = [...uniqueNew, ...prev];
            saveStoredFinancialEntries(next);
            return next;
          });
        }

        if (updatedRecurrences.length > 0) {
          const updatedMap = new Map(updatedRecurrences.map((r) => [r.id, r]));
          setFinancialRecurrences((prev) => {
            const next = prev.map((r) => updatedMap.get(r.id) || r);
            saveStoredFinancialRecurrences(next);
            return next;
          });
        }

        appendAuditLogsLocally(auditLogs);

        try {
          if (createdEntries.length > 0) {
            await batchSyncFinancialEntriesToFirestore(createdEntries);
          }
          if (updatedRecurrences.length > 0) {
            await batchSyncFinancialRecurrencesToFirestore(updatedRecurrences);
          }
          if (auditLogs.length > 0) {
            await batchSyncFinancialAuditLogsToFirestore(auditLogs);
          }
          setFinanceCloudBlocked(false);
          if (!silent && createdEntries.length > 0) {
            notifySaved(
              `${createdEntries.length} ocorrência(s) recorrente(s) gerada(s) em aberto.`
            );
          }
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else if (!silent) {
            notifySyncFailure('geração de recorrências', err);
          }
        }

        return createdEntries.length;
      } finally {
        processingRecurrencesRef.current = false;
      }
    },
    [
      appendAuditLogsLocally,
      financialSettings.timezone,
      notifySaved,
      notifySyncFailure,
      userName,
    ]
  );

  // Processamento idempotente de ocorrências recorrentes vencidas/devidas até hoje
  useEffect(() => {
    if (!authReady || !isAuthenticated || !authConfigValid) return;
    const todayRef = getTodayInTimezone(financialSettings.timezone || KAIZEN_TIMEZONE);
    const hasDue = financialRecurrences.some(
      (r) => r.status === 'ativa' && (r.nextOccurrenceDate || r.startDate) <= todayRef
    );
    if (!hasDue) return;
    runDueRecurrencesCheck(financialRecurrences, financialEntries, true);
  }, [
    authReady,
    isAuthenticated,
    authConfigValid,
    financialRecurrences,
    financialEntries,
    financialSettings.timezone,
    runDueRecurrencesCheck,
  ]);

  const handleProcessDueRecurrences = async (): Promise<number> => {
    return runDueRecurrencesCheck(financialRecurrences, financialEntries, false);
  };

  const handleSaveFinancialCategory = async (payload: {
    editingId?: string;
    name: string;
    kind: FinancialKind;
    description?: string;
    active: boolean;
  }) => {
    const existing = payload.editingId
      ? financialCategories.find((c) => c.id === payload.editingId)
      : undefined;
    const now = new Date().toISOString();

    const category: FinancialCategory = existing
      ? {
          ...existing,
          name: payload.name.trim(),
          kind: payload.kind,
          description: payload.description?.trim() || undefined,
          active: payload.active,
          updatedAt: now,
        }
      : {
          ...createFinancialCategory({
            name: payload.name,
            kind: payload.kind,
            description: payload.description,
          }),
          active: payload.active,
        };

    const auditLog = createFinancialAuditLog({
      entityType: 'category',
      entityId: category.id,
      action: existing ? 'edicao' : 'criacao',
      description: existing
        ? `Categoria "${category.name}" atualizada (${category.active ? 'ativa' : 'inativa'}).`
        : `Categoria "${category.name}" (${category.kind}) criada.`,
      actor: userName,
      createdAt: now,
    });

    setFinancialCategories((prev) => {
      const next = existing
        ? prev.map((c) => (c.id === category.id ? category : c))
        : [...prev, category];
      saveStoredFinancialCategories(next);
      return next;
    });
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialCategoryToFirestore(category);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved(`Categoria "${category.name}" salva.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved('Categoria salva localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('salvamento de categoria financeira', err);
      }
    }
  };

  const handleSaveFinancialSettings = async (
    nextSettings: FinancialSettings,
    openingBalanceChanged: boolean
  ) => {
    const auditLog = createFinancialAuditLog({
      entityType: 'settings',
      entityId: nextSettings.id || 'default',
      action: 'configuracao_alterada',
      description: openingBalanceChanged
        ? `Saldo inicial de caixa atualizado para R$ ${(
            nextSettings.openingBalanceCents / 100
          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
        : 'Configurações financeiras e meios de pagamento atualizados.',
      ...(openingBalanceChanged
        ? { amountCents: nextSettings.openingBalanceCents }
        : {}),
      actor: userName,
    });

    setFinancialSettings(nextSettings);
    saveStoredFinancialSettings(nextSettings);
    appendAuditLogsLocally([auditLog]);

    setSyncStatus('saving');
    try {
      await syncFinancialSettingsToFirestore(nextSettings);
      await syncFinancialAuditLogToFirestore(auditLog);
      setFinanceCloudBlocked(false);
      notifySaved('Configurações financeiras gravadas.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved(
          'Configurações financeiras salvas localmente (aguardando publicação de firestore.rules).'
        );
      } else {
        notifySyncFailure('configurações financeiras', err);
      }
    }
  };

  const handleGenerateProposalFinancialForecast = async (
    input: Omit<BuildProposalFinancialInput, 'actor'>
  ): Promise<{ createdEntriesCount: number; createdRecurrencesCount: number }> => {
    const { entries: createdEntries, recurrences: createdRecurrences, auditLogs } =
      buildProposalFinancialForecast(
        { ...input, actor: userName },
        financialEntries,
        financialRecurrences
      );

    if (createdEntries.length > 0) {
      setFinancialEntries((prev) => {
        const next = [...createdEntries, ...prev];
        saveStoredFinancialEntries(next);
        return next;
      });
    }
    if (createdRecurrences.length > 0) {
      setFinancialRecurrences((prev) => {
        const next = [...createdRecurrences, ...prev];
        saveStoredFinancialRecurrences(next);
        return next;
      });
    }
    appendAuditLogsLocally(auditLogs);

    setSyncStatus('saving');
    try {
      if (createdEntries.length > 0) {
        await batchSyncFinancialEntriesToFirestore(createdEntries);
      }
      if (createdRecurrences.length > 0) {
        await batchSyncFinancialRecurrencesToFirestore(createdRecurrences);
      }
      if (auditLogs.length > 0) {
        await batchSyncFinancialAuditLogsToFirestore(auditLogs);
      }
      setFinanceCloudBlocked(false);
      notifySaved(
        `Previsão financeira gerada (${createdEntries.length} lançamento(s) e ${createdRecurrences.length} recorrência(s)).`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setFinanceCloudBlocked(true);
        notifySaved(
          'Previsão financeira salva localmente (aguardando publicação de firestore.rules).'
        );
      } else {
        notifySyncFailure('geração de previsão financeira', err);
      }
    }

    return {
      createdEntriesCount: createdEntries.length,
      createdRecurrencesCount: createdRecurrences.length,
    };
  };

  // Handler: Etapa 5 — Central de Materiais, Documentos, Scripts & Biblioteca de Modelos
  const handleSaveResourceFile = async (file: ResourceFile, mode: 'create' | 'edit') => {
    setResourceFiles((prev) => {
      const next =
        mode === 'create'
          ? [file, ...prev.filter((f) => f.id !== file.id)]
          : prev.map((f) => (f.id === file.id ? file : f));
      saveStoredResourceFiles(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncResourceFileToFirestore(file);
      setResourcesCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Arquivo "${file.name}" registrado na Central.`
          : `Arquivo "${file.name}" atualizado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved(
          `Arquivo "${file.name}" salvo localmente (aguardando publicação de firestore.rules).`
        );
      } else {
        notifySyncFailure('salvamento de arquivo', err);
      }
    }
  };

  const handleDeleteResourceFile = async (fileId: string) => {
    setResourceFiles((prev) => {
      const next = prev.filter((f) => f.id !== fileId);
      saveStoredResourceFiles(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteResourceFileFromFirestore(fileId);
      setResourcesCloudBlocked(false);
      notifySaved('Arquivo removido da Central.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved('Arquivo removido localmente (aguardando publicação de firestore.rules).');
      } else {
        notifySyncFailure('exclusão de arquivo', err);
      }
    }
  };

  const handleSaveResourceFolder = async (
    folder: ResourceFolder,
    mode: 'create' | 'edit'
  ) => {
    setResourceFolders((prev) => {
      const next =
        mode === 'create'
          ? [folder, ...prev.filter((f) => f.id !== folder.id)]
          : prev.map((f) => (f.id === folder.id ? folder : f));
      saveStoredResourceFolders(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncResourceFolderToFirestore(folder);
      setResourcesCloudBlocked(false);
      notifySaved(`Pasta "${folder.name}" salva.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved(`Pasta "${folder.name}" salva localmente.`);
      } else {
        notifySyncFailure('salvamento de pasta', err);
      }
    }
  };

  const handleDeleteResourceFolder = async (folderId: string) => {
    const nowIso = new Date().toISOString();
    const affectedFiles: ResourceFile[] = [];
    setResourceFolders((prev) => {
      const next = prev.filter((f) => f.id !== folderId);
      saveStoredResourceFolders(next);
      return next;
    });
    setResourceFiles((prev) => {
      const next = prev.map((f) => {
        if (f.folderId === folderId) {
          const updated: ResourceFile = { ...f, folderId: undefined, updatedAt: nowIso };
          affectedFiles.push(updated);
          return updated;
        }
        return f;
      });
      if (affectedFiles.length > 0) saveStoredResourceFiles(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteResourceFolderFromFirestore(folderId);
      if (affectedFiles.length > 0) {
        await batchSyncResourceFilesToFirestore(affectedFiles);
      }
      setResourcesCloudBlocked(false);
      notifySaved('Pasta removida (arquivos preservados na raiz).');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved('Pasta removida localmente.');
      } else {
        notifySyncFailure('exclusão de pasta', err);
      }
    }
  };

  const handleSaveResourceCategory = async (
    category: ResourceCategory,
    mode: 'create' | 'edit'
  ) => {
    setResourceCategories((prev) => {
      const next =
        mode === 'create'
          ? [...prev.filter((c) => c.id !== category.id), category]
          : prev.map((c) => (c.id === category.id ? category : c));
      saveStoredResourceCategories(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncResourceCategoryToFirestore(category);
      setResourcesCloudBlocked(false);
      notifySaved(`Categoria "${category.name}" salva.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved(`Categoria "${category.name}" salva localmente.`);
      } else {
        notifySyncFailure('salvamento de categoria da central', err);
      }
    }
  };

  const handleDeleteResourceCategory = async (categoryId: string) => {
    setResourceCategories((prev) => {
      const next = prev.filter((c) => c.id !== categoryId);
      saveStoredResourceCategories(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteResourceCategoryFromFirestore(categoryId);
      setResourcesCloudBlocked(false);
      notifySaved('Categoria removida.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved('Categoria removida localmente.');
      } else {
        notifySyncFailure('exclusão de categoria da central', err);
      }
    }
  };

  const handleSaveCommercialScript = async (
    script: CommercialScript,
    mode: 'create' | 'edit'
  ) => {
    setCommercialScripts((prev) => {
      const next =
        mode === 'create'
          ? [script, ...prev.filter((s) => s.id !== script.id)]
          : prev.map((s) => (s.id === script.id ? script : s));
      saveStoredCommercialScripts(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncCommercialScriptToFirestore(script);
      setResourcesCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Script "${script.title}" criado.`
          : `Script "${script.title}" atualizado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved(`Script "${script.title}" salvo localmente.`);
      } else {
        notifySyncFailure('salvamento de script comercial', err);
      }
    }
  };

  const handleDeleteCommercialScript = async (scriptId: string) => {
    setCommercialScripts((prev) => {
      const next = prev.filter((s) => s.id !== scriptId);
      saveStoredCommercialScripts(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await deleteCommercialScriptFromFirestore(scriptId);
      setResourcesCloudBlocked(false);
      notifySaved('Script removido.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved('Script removido localmente.');
      } else {
        notifySyncFailure('exclusão de script comercial', err);
      }
    }
  };

  const handleSaveModelTemplate = async (
    template: ModelTemplate,
    mode: 'create' | 'edit'
  ) => {
    setModelTemplates((prev) => {
      const next =
        mode === 'create'
          ? [template, ...prev.filter((t) => t.id !== template.id)]
          : prev.map((t) => (t.id === template.id ? template : t));
      saveStoredModelTemplates(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await syncModelTemplateToFirestore(template);
      setResourcesCloudBlocked(false);
      notifySaved(
        mode === 'create'
          ? `Modelo "${template.title}" adicionado à biblioteca.`
          : `Modelo "${template.title}" atualizado.`
      );
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
        notifySaved(`Modelo "${template.title}" salvo localmente.`);
      } else {
        notifySyncFailure('salvamento de modelo', err);
      }
    }
  };

  const handleCreateProposalFromTemplate = async (
    draft: Omit<ProposalContract, 'id' | 'createdAt'>
  ) => {
    const nowIso = new Date().toISOString();
    const created: ProposalContract = {
      ...draft,
      id: generateProposalId(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await handleSaveProposal(created, 'create');
    setExternalPreviewProposalId(created.id);
    setActiveTab('proposals');
  };

  const handleCreateProjectFromTemplate = async (params: {
    project: Project;
    initialTasks: Task[];
  }) => {
    await handleCreateProjectWithTasks(params.project, params.initialTasks);
    setExternalSelectedProjectId(params.project.id);
    setActiveTab('projects');
  };

  const handleCreateTasksFromTemplate = async (newTasks: Task[]) => {
    if (newTasks.length === 0) return;
    setTasks((prev) => {
      const next = [...newTasks, ...prev];
      saveStoredTasks(next);
      return next;
    });

    setSyncStatus('saving');
    try {
      await batchSyncTasksToFirestore(newTasks);
      setTasksCloudBlocked(false);
      notifySaved(`${newTasks.length} tarefa(s) independente(s) gerada(s) em Minhas Tarefas.`);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setTasksCloudBlocked(true);
        notifySaved(`${newTasks.length} tarefa(s) criada(s) localmente.`);
      } else {
        notifySyncFailure('criação de tarefas via modelo', err);
      }
    }
    setActiveTab('tasks');
  };

  const handleSyncFilesForTask = async (taskId: string, selectedFileIds: string[]) => {
    const selectedSet = new Set(selectedFileIds);
    const updatedFiles: ResourceFile[] = [];

    setResourceFiles((prev) => {
      const next = prev.map((file) => {
        const currentlyLinked = (file.linkedTaskIds || []).includes(taskId);
        const shouldBeLinked = selectedSet.has(file.id);
        if (currentlyLinked === shouldBeLinked) return file;
        const nextFile = shouldBeLinked
          ? linkFileToTask(file, taskId)
          : unlinkFileFromTask(file, taskId);
        updatedFiles.push(nextFile);
        return nextFile;
      });
      if (updatedFiles.length > 0) saveStoredResourceFiles(next);
      return next;
    });

    if (updatedFiles.length === 0) return;
    try {
      await batchSyncResourceFilesToFirestore(updatedFiles);
      setResourcesCloudBlocked(false);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
      } else {
        notifySyncFailure('vínculo de arquivos na tarefa', err);
      }
    }
  };

  const handleSyncFilesForSocialPost = async (
    postId: string,
    clientId: string,
    selectedFileIds: string[]
  ) => {
    const selectedSet = new Set(selectedFileIds);
    const updatedFiles: ResourceFile[] = [];

    setResourceFiles((prev) => {
      const next = prev.map((file) => {
        const currentlyLinked = (file.linkedSocialPostIds || []).includes(postId);
        const shouldBeLinked = selectedSet.has(file.id);
        if (currentlyLinked === shouldBeLinked) return file;
        let nextFile = shouldBeLinked
          ? linkFileToSocialPost(file, postId)
          : unlinkFileFromSocialPost(file, postId);
        if (shouldBeLinked && !nextFile.clientId && clientId) {
          nextFile = {
            ...nextFile,
            clientId,
            clientSection: nextFile.clientSection || 'imagens',
          };
        }
        updatedFiles.push(nextFile);
        return nextFile;
      });
      if (updatedFiles.length > 0) saveStoredResourceFiles(next);
      return next;
    });

    if (updatedFiles.length === 0) return;
    try {
      await batchSyncResourceFilesToFirestore(updatedFiles);
      setResourcesCloudBlocked(false);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setResourcesCloudBlocked(true);
      } else {
        notifySyncFailure('vínculo de arquivos na publicação social', err);
      }
    }
  };

  // Etapa 6: Relatórios Personalizados e Preferências de Inteligência
  const handleSaveCustomReport = async (report: SavedCustomReport) => {
    const normalized: SavedCustomReport = {
      ...report,
      schemaVersion: report.schemaVersion || 1,
      updatedAt: new Date().toISOString(),
    };
    setSavedCustomReports((prev) => {
      const exists = prev.some((r) => r.id === normalized.id);
      const next = exists
        ? prev.map((r) => (r.id === normalized.id ? normalized : r))
        : [normalized, ...prev];
      saveStoredSavedCustomReports(next);
      return next;
    });
    setSyncStatus('saving');
    try {
      await syncCustomReportToFirestore(normalized);
      setAnalyticsCloudBlocked(false);
      notifySaved('Modelo de relatório salvo.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setAnalyticsCloudBlocked(true);
        notifySaved('Modelo salvo localmente neste navegador.');
      } else {
        notifySyncFailure('salvamento de relatório personalizado', err);
      }
    }
  };

  const handleDeleteCustomReport = async (reportId: string) => {
    setSavedCustomReports((prev) => {
      const next = prev.filter((r) => r.id !== reportId);
      saveStoredSavedCustomReports(next);
      return next;
    });
    setSyncStatus('saving');
    try {
      await deleteCustomReportFromFirestore(reportId);
      setAnalyticsCloudBlocked(false);
      notifySaved('Modelo de relatório removido.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setAnalyticsCloudBlocked(true);
        notifySaved('Modelo removido localmente.');
      } else {
        notifySyncFailure('exclusão de relatório personalizado', err);
      }
    }
  };

  const handleToggleFavoriteCustomReport = async (report: SavedCustomReport) => {
    await handleSaveCustomReport({
      ...report,
      favorite: !report.favorite,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSaveAnalyticsPreferences = async (prefs: AnalyticsPreferences) => {
    const normalized: AnalyticsPreferences = {
      ...prefs,
      id: 'default',
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    setAnalyticsSettings(normalized);
    saveStoredAnalyticsPreferences(normalized);
    setSyncStatus('saving');
    try {
      await syncAnalyticsSettingsToFirestore(normalized);
      setAnalyticsCloudBlocked(false);
      notifySaved('Preferências de relatórios atualizadas.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setAnalyticsCloudBlocked(true);
        notifySaved('Preferências salvas localmente.');
      } else {
        notifySyncFailure('salvamento de preferências de relatórios', err);
      }
    }
  };

  // Handler: Safe, awaited backup restore (merges verified records preserving IDs)
  const handleRestoreBackup = async (payload: {
    niches: NicheCampaign[];
    leads: Lead[];
    importedSheets: ImportedSheet[];
    clients?: Client[];
    proposals?: ProposalContract[];
    projects?: Project[];
    tasks?: Task[];
    agendaEvents?: AgendaEvent[];
    socialChannels?: SocialChannel[];
    socialPosts?: SocialPost[];
    financialEntries?: FinancialEntry[];
    financialTransactions?: FinancialTransaction[];
    financialCategories?: FinancialCategory[];
    financialRecurrences?: FinancialRecurrence[];
    financialSettings?: FinancialSettings;
    financialAuditLogs?: FinancialAuditLog[];
    resourceFiles?: ResourceFile[];
    resourceFolders?: ResourceFolder[];
    resourceCategories?: ResourceCategory[];
    commercialScripts?: CommercialScript[];
    modelTemplates?: ModelTemplate[];
    savedReports?: SavedCustomReport[];
    analyticsSettings?: AnalyticsPreferences;
    systemSettings?: SystemSettings;
    automationSettings?: AutomationRuleSetting[];
    notifications?: SystemNotification[];
    userName?: string;
  }) => {
    setSyncStatus('saving');
    try {
      await batchSyncNichesToFirestore(payload.niches);
      await batchSyncLeadsToFirestore(payload.leads);
      if (payload.importedSheets.length > 0) {
        await batchSyncImportedSheetsToFirestore(payload.importedSheets);
      }

      if (payload.clients && payload.clients.length > 0) {
        setClients(payload.clients);
        saveStoredClients(payload.clients);
        try {
          await batchSyncClientsToFirestore(payload.clients);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setClientsCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.proposals && payload.proposals.length > 0) {
        setProposals(payload.proposals);
        saveStoredProposals(payload.proposals);
        try {
          await batchSyncProposalsToFirestore(payload.proposals);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setProposalsCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.projects && payload.projects.length > 0) {
        setProjects(payload.projects);
        saveStoredProjects(payload.projects);
        try {
          await batchSyncProjectsToFirestore(payload.projects);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setProjectsCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.tasks && payload.tasks.length > 0) {
        setTasks(payload.tasks);
        saveStoredTasks(payload.tasks);
        try {
          await batchSyncTasksToFirestore(payload.tasks);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setTasksCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.agendaEvents && payload.agendaEvents.length > 0) {
        setAgendaEvents(payload.agendaEvents);
        saveStoredAgendaEvents(payload.agendaEvents);
        try {
          await batchSyncAgendaEventsToFirestore(payload.agendaEvents);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setAgendaCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.socialChannels && payload.socialChannels.length > 0) {
        setSocialChannels(payload.socialChannels);
        saveStoredSocialChannels(payload.socialChannels);
        try {
          await batchSyncSocialChannelsToFirestore(payload.socialChannels);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSocialCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.socialPosts && payload.socialPosts.length > 0) {
        setSocialPosts(payload.socialPosts);
        saveStoredSocialPosts(payload.socialPosts);
        try {
          await batchSyncSocialPostsToFirestore(payload.socialPosts);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSocialCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.financialCategories && payload.financialCategories.length > 0) {
        const { categories } = ensureDefaultFinancialCategories(payload.financialCategories);
        setFinancialCategories(categories);
        saveStoredFinancialCategories(categories);
        try {
          await batchSyncFinancialCategoriesToFirestore(categories);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.financialRecurrences && payload.financialRecurrences.length > 0) {
        setFinancialRecurrences(payload.financialRecurrences);
        saveStoredFinancialRecurrences(payload.financialRecurrences);
        try {
          await batchSyncFinancialRecurrencesToFirestore(payload.financialRecurrences);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.financialEntries && payload.financialEntries.length > 0) {
        setFinancialEntries(payload.financialEntries);
        saveStoredFinancialEntries(payload.financialEntries);
        try {
          await batchSyncFinancialEntriesToFirestore(payload.financialEntries);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.financialTransactions && payload.financialTransactions.length > 0) {
        setFinancialTransactions(payload.financialTransactions);
        saveStoredFinancialTransactions(payload.financialTransactions);
        try {
          await batchSyncFinancialTransactionsToFirestore(payload.financialTransactions);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.financialSettings) {
        setFinancialSettings(payload.financialSettings);
        saveStoredFinancialSettings(payload.financialSettings);
        try {
          await syncFinancialSettingsToFirestore(payload.financialSettings);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.financialAuditLogs && payload.financialAuditLogs.length > 0) {
        setFinancialAuditLogs(payload.financialAuditLogs);
        saveStoredFinancialAuditLogs(payload.financialAuditLogs);
        try {
          await batchSyncFinancialAuditLogsToFirestore(payload.financialAuditLogs);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setFinanceCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.resourceCategories && payload.resourceCategories.length > 0) {
        const { categories: ensured } = ensureDefaultCategories(payload.resourceCategories);
        setResourceCategories(ensured);
        saveStoredResourceCategories(ensured);
        try {
          await batchSyncResourceCategoriesToFirestore(ensured);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setResourcesCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.resourceFolders && payload.resourceFolders.length > 0) {
        setResourceFolders(payload.resourceFolders);
        saveStoredResourceFolders(payload.resourceFolders);
        try {
          await batchSyncResourceFoldersToFirestore(payload.resourceFolders);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setResourcesCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.resourceFiles && payload.resourceFiles.length > 0) {
        setResourceFiles(payload.resourceFiles);
        saveStoredResourceFiles(payload.resourceFiles);
        try {
          await batchSyncResourceFilesToFirestore(payload.resourceFiles);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setResourcesCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.commercialScripts && payload.commercialScripts.length > 0) {
        setCommercialScripts(payload.commercialScripts);
        saveStoredCommercialScripts(payload.commercialScripts);
        try {
          await batchSyncCommercialScriptsToFirestore(payload.commercialScripts);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setResourcesCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.modelTemplates && payload.modelTemplates.length > 0) {
        setModelTemplates(payload.modelTemplates);
        saveStoredModelTemplates(payload.modelTemplates);
        try {
          await batchSyncModelTemplatesToFirestore(payload.modelTemplates);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setResourcesCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.savedReports && payload.savedReports.length > 0) {
        setSavedCustomReports(payload.savedReports);
        saveStoredSavedCustomReports(payload.savedReports);
        try {
          await batchSyncCustomReportsToFirestore(payload.savedReports);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setAnalyticsCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.analyticsSettings) {
        setAnalyticsSettings(payload.analyticsSettings);
        saveStoredAnalyticsPreferences(payload.analyticsSettings);
        try {
          await syncAnalyticsSettingsToFirestore(payload.analyticsSettings);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setAnalyticsCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.systemSettings) {
        const normalizedSys = normalizeSystemSettings(
          payload.systemSettings,
          payload.userName || userName
        );
        setSystemSettings(normalizedSys);
        saveStoredSystemSettings(normalizedSys);
        try {
          await syncSystemSettingsToFirestore(normalizedSys);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSystemCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.automationSettings && payload.automationSettings.length > 0) {
        const mergedRules = mergeAutomationRulesWithDefaults(payload.automationSettings);
        setAutomationRules(mergedRules);
        saveStoredAutomationSettings(mergedRules);
        try {
          await batchSyncAutomationRulesToFirestore(mergedRules);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSystemCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.notifications && payload.notifications.length > 0) {
        setNotifications(payload.notifications);
        notificationsRef.current = payload.notifications;
        saveStoredNotifications(payload.notifications);
        try {
          await batchSyncNotificationsToFirestore(payload.notifications);
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSystemCloudBlocked(true);
          } else {
            throw err;
          }
        }
      }

      if (payload.userName) {
        setUserName(payload.userName);
      }
      await appendSystemLog(
        'info',
        'backup',
        'Backup restaurado com integridade',
        `Restauração confirmada (${payload.leads.length} leads, ${payload.clients?.length || 0} clientes, ${payload.proposals?.length || 0} propostas).`
      );
      notifySaved('Backup restaurado e confirmado.');
    } catch (err) {
      notifySyncFailure('restauração de backup', err);
      throw err;
    }
  };

  // Etapa 7 Handlers: Configurações, Notificações, Automações e Assistente IA
  const handleSaveSystemSettings = async (nextSettings: SystemSettings) => {
    const normalized = normalizeSystemSettings(nextSettings, userName);
    setSystemSettings(normalized);
    saveStoredSystemSettings(normalized);
    if (normalized.adminProfile.displayName) {
      setUserName(normalized.adminProfile.displayName);
    }
    setSyncStatus('saving');
    try {
      await syncSystemSettingsToFirestore(normalized);
      await appendSystemLog(
        'info',
        'sistema',
        'Configurações atualizadas',
        `Preferências e marca (${normalized.adminProfile.agencyName}) salvas.`
      );
      notifySaved('Configurações do sistema salvas.');
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSystemCloudBlocked(true);
      } else {
        notifySyncFailure('salvamento de configurações', err);
        throw err;
      }
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    const nowIso = new Date().toISOString();
    let updatedItem: SystemNotification | null = null;
    setNotifications((prev) => {
      const next = prev.map((n) => {
        if (n.id !== notificationId) return n;
        updatedItem = { ...n, read: true, readAt: n.readAt || nowIso, updatedAt: nowIso };
        return updatedItem;
      });
      notificationsRef.current = next;
      saveStoredNotifications(next);
      return next;
    });
    if (updatedItem) {
      try {
        await syncNotificationToFirestore(updatedItem);
      } catch (err) {
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        }
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const nowIso = new Date().toISOString();
    const changed: SystemNotification[] = [];
    setNotifications((prev) => {
      const next = prev.map((n) => {
        if (n.read || n.dismissed) return n;
        const upd = { ...n, read: true, readAt: nowIso, updatedAt: nowIso };
        changed.push(upd);
        return upd;
      });
      notificationsRef.current = next;
      saveStoredNotifications(next);
      return next;
    });
    if (changed.length > 0) {
      try {
        await batchSyncNotificationsToFirestore(changed);
      } catch (err) {
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        }
      }
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    const nowIso = new Date().toISOString();
    let dismissedItem: SystemNotification | null = null;
    setNotifications((prev) => {
      const next = prev.map((n) => {
        if (n.id !== notificationId) return n;
        dismissedItem = { ...n, dismissed: true, read: true, updatedAt: nowIso };
        return dismissedItem;
      });
      notificationsRef.current = next;
      saveStoredNotifications(next);
      return next;
    });
    if (dismissedItem) {
      try {
        await syncNotificationToFirestore(dismissedItem);
      } catch (err) {
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        }
      }
    }
  };

  const handleToggleAutomationRule = async (ruleId: string, enabled: boolean) => {
    const nowIso = new Date().toISOString();
    let updatedRule: AutomationRuleSetting | null = null;
    setAutomationRules((prev) => {
      const next = prev.map((r) => {
        if (r.id !== ruleId) return r;
        updatedRule = { ...r, enabled, updatedAt: nowIso };
        return updatedRule;
      });
      saveStoredAutomationSettings(next);
      return next;
    });
    if (updatedRule) {
      try {
        await syncAutomationRuleToFirestore(updatedRule);
      } catch (err) {
        if (isFirestorePermissionDeniedError(err)) {
          setSystemCloudBlocked(true);
        }
      }
    }
  };

  const executeAutomationBatch = useCallback(
    async (triggerType: 'manual' | 'abertura_sistema', onlyRuleId?: string) => {
      const { updatedRules, newLogs } = runAutomationRules({
        rules: automationRules,
        data: {
          leads,
          proposals,
          projects,
          tasks,
          agendaEvents,
          financialEntries,
          financialRecurrences,
          financialAlertDaysAhead: financialSettings.alertDaysAhead ?? 5,
        },
        triggerType,
        onlyRuleId,
      });

      setAutomationRules(updatedRules);
      saveStoredAutomationSettings(updatedRules);
      if (newLogs.length > 0) {
        setAutomationLogs((prev) => {
          const next = [...newLogs, ...prev].slice(0, 120);
          saveStoredAutomationLogs(next);
          return next;
        });
      }

      if (!systemCloudBlocked) {
        try {
          await batchSyncAutomationRulesToFirestore(updatedRules);
          for (const log of newLogs.slice(0, 15)) {
            await syncAutomationLogToFirestore(log);
          }
        } catch (err) {
          if (isFirestorePermissionDeniedError(err)) {
            setSystemCloudBlocked(true);
          }
        }
      }

      const findingsTotal = newLogs.reduce((acc, l) => acc + l.findingsCount, 0);
      await appendSystemLog(
        'info',
        'automacoes',
        onlyRuleId ? 'Regra de automação executada' : 'Rodada de automações concluída',
        `${newLogs.length} regra(s) avaliada(s) (${triggerType}) com ${findingsTotal} achado(s).`
      );
    },
    [
      automationRules,
      leads,
      proposals,
      projects,
      tasks,
      agendaEvents,
      financialEntries,
      financialRecurrences,
      financialSettings.alertDaysAhead,
      systemCloudBlocked,
      appendSystemLog,
    ]
  );

  // One-shot automatic monitoring evaluation when opening the system
  useEffect(() => {
    if (!authReady || !isAuthenticated || !authConfigValid) return;
    if (autoRunOnOpenDoneRef.current) return;
    if (!systemSettings.preferences.autoRunAutomationsOnOpen) return;
    autoRunOnOpenDoneRef.current = true;
    executeAutomationBatch('abertura_sistema');
  }, [
    authReady,
    isAuthenticated,
    authConfigValid,
    systemSettings.preferences.autoRunAutomationsOnOpen,
    executeAutomationBatch,
  ]);

  const handleSaveAiConversation = async (conv: AiConversation) => {
    setAiConversations((prev) => {
      const exists = prev.some((c) => c.id === conv.id);
      const next = exists
        ? prev.map((c) => (c.id === conv.id ? conv : c))
        : [conv, ...prev];
      next.sort(
        (a, b) => new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime()
      );
      saveStoredAiConversations(next);
      return next;
    });
    try {
      await syncAiConversationToFirestore(conv);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSystemCloudBlocked(true);
      }
    }
  };

  const handleDeleteAiConversation = async (convId: string) => {
    setAiConversations((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      saveStoredAiConversations(next);
      return next;
    });
    try {
      await deleteAiConversationFromFirestore(convId);
    } catch (err) {
      if (isFirestorePermissionDeniedError(err)) {
        setSystemCloudBlocked(true);
      }
    }
  };

  const handleCreateTaskFromAi = async (task: Task) => {
    await handleSaveTask(task, 'create');
    notifySaved(`Tarefa "${task.title}" criada a partir do Assistente IA.`);
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
      <div className="flex items-center justify-center min-h-screen bg-[var(--kz-bg-canvas)]">
        <Spinner size="md" label="Verificando sessão autenticada..." />
      </div>
    );
  }

  if (!isAuthenticated || !authConfigValid) {
    return <LoginView sessionNotice={sessionNotice} authConfigValid={authConfigValid} />;
  }

  if (!activeNiche) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--kz-bg-canvas)]">
        <Spinner size="md" label="Carregando Kaizen Gestão..." />
      </div>
    );
  }

  const isCrmRoute =
    activeTab === 'kanban' || activeTab === 'leads_list' || activeTab === 'importer';

  const unbuiltModuleTabs: AppTab[] = [];
  const unreadNotificationsCount = notifications.filter((n) => !n.read && !n.dismissed).length;

  const handleSelectNavigationTab = (tab: AppTab) => {
    setResourcesSubTabOverride(null);
    setActiveTab(tab);
  };

  return (
    <div className="h-screen h-dvh bg-[var(--kz-bg-canvas)] text-[var(--kz-text-primary)] flex w-full max-w-full overflow-hidden">
      {/* Kaizen Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectNavigationTab}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        mobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        agendaAlertsCount={
          meetingLeadsCount + todayCallbacksCount + dueAgendaEventsCount + dueTasksCount
        }
        unreadNotificationsCount={unreadNotificationsCount}
        brandName={systemSettings.visualIdentity.brandName}
        compactLogoUrl={systemSettings.visualIdentity.compactLogoUrl}
      />

      {/* Right Workspace Column: Header + Contextual SubNav + Main Content */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
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
          onUpdateUserName={(name) => {
            setUserName(name);
            const updated = normalizeSystemSettings(
              {
                ...systemSettings,
                adminProfile: { ...systemSettings.adminProfile, displayName: name },
                updatedAt: new Date().toISOString(),
              },
              name
            );
            setSystemSettings(updated);
            saveStoredSystemSettings(updated);
          }}
          leads={activeNicheLeads}
          tasks={tasks}
          agendaEvents={agendaEvents}
          financialEntries={financialEntries}
          financialAlertDaysAhead={financialSettings.alertDaysAhead ?? 5}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          photoUrl={systemSettings.adminProfile.photoUrl}
          agencyName={systemSettings.adminProfile.agencyName}
          totalLeadsCount={activeNicheLeads.length}
          allLeadsCount={leads.length}
          allNichesCount={niches.length}
          importedSheetsCount={importedSheets.length}
          lastBackupAt={loadLastBackupTimestamp()}
          onLogout={handleLogout}
          isCloudSynced={isCloudSynced}
          syncStatus={syncStatus}
          onClearAllContacts={handleClearAllContacts}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {isCrmRoute && (
          <CrmSubNav
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            leadsCount={activeNicheLeads.length}
            importedSheetsCount={importedSheets.length}
          />
        )}

        {/* Explicit Sync Error Banner */}
        {syncError && (
          <div className="px-4 sm:px-6 pt-3 shrink-0">
            <Alert variant="danger" onDismiss={() => setSyncError(null)}>
              {syncError}
            </Alert>
          </div>
        )}

        {/* Main Content Area based on Active Tab */}
        <main
          className={`flex-1 min-w-0 w-full max-w-full ${
            activeTab === 'kanban' ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              niche={activeNiche}
              leads={activeNicheLeads}
              allLeads={leads}
              clients={clients}
              projects={projects}
              tasks={tasks}
              agendaEvents={agendaEvents}
              socialPosts={socialPosts}
              financialEntries={financialEntries}
              financialTransactions={financialTransactions}
              nichesCount={niches.length}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenLeadModal={(lead) => setSelectedLead(lead)}
            />
          )}

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

          {activeTab === 'leads_list' && (
            <LeadsListView
              niche={activeNiche}
              leads={activeNicheLeads}
              onMoveStage={handleMoveStage}
              onOpenLeadModal={(lead) => setSelectedLead(lead)}
              onOpenNewLeadModal={(stage) => {
                setNewLeadDefaultStage(stage || 'leads_sem_contato');
                setIsNewLeadModalOpen(true);
              }}
              onFastWhatsAppContacted={handleFastWhatsAppContacted}
              onSwitchToImporter={() => setActiveTab('importer')}
            />
          )}

          {activeTab === 'agenda' && (
            <AgendaView
              niche={activeNiche}
              leads={activeNicheLeads}
              allLeads={leads}
              clients={clients}
              projects={projects}
              tasks={tasks}
              agendaEvents={agendaEvents}
              userName={userName}
              cloudPermissionBlocked={agendaCloudBlocked}
              initialLeadIdToEdit={activeLeadForAgendaId}
              onClearInitialLeadToEdit={() => setActiveLeadForAgendaId(null)}
              initialNewEventClientId={initialNewEventClientId}
              onClearInitialNewEventClientId={() => setInitialNewEventClientId(null)}
              onUpdateLead={handleUpdateLead}
              onMoveStage={handleMoveStage}
              onOpenLeadModal={(lead: Lead) => setSelectedLead(lead)}
              onSaveAgendaEvent={handleSaveAgendaEvent}
              onDeleteAgendaEvent={handleDeleteAgendaEvent}
              onOpenProject={(projectId) => {
                setExternalSelectedProjectId(projectId);
                setActiveTab('projects');
              }}
              onOpenClient={(clientId) => {
                setExternalSelectedClientId(clientId);
                setActiveTab('clients');
              }}
              onNavigate={(tab) => setActiveTab(tab)}
              onSwitchToKanban={() => setActiveTab('kanban')}
            />
          )}

          {activeTab === 'scripts' && (
            <ScriptsView
              niche={activeNiche}
              leads={activeNicheLeads}
              userName={userName}
              targetLeadId={activeLeadForScriptId}
              commercialScriptsCount={commercialScripts.filter((s) => s.status === 'ativo').length}
              onUpdateNicheScripts={handleUpdateNicheScripts}
              onFastWhatsAppContacted={handleFastWhatsAppContacted}
              onOpenCommercialScriptsCenter={() => {
                setResourcesSubTabOverride('scripts');
                setActiveTab('documents');
              }}
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

          {activeTab === 'clients' && (
            <ClientsView
              clients={clients}
              leads={leads}
              niches={niches}
              proposals={proposals}
              projects={projects}
              tasks={tasks}
              agendaEvents={agendaEvents}
              socialChannels={socialChannels}
              socialPosts={socialPosts}
              financialEntries={financialEntries}
              financialTransactions={financialTransactions}
              resourceFiles={resourceFiles}
              resourceFolders={resourceFolders}
              resourceCategories={resourceCategories}
              userName={userName}
              cloudPermissionBlocked={clientsCloudBlocked}
              externalSelectedClientId={externalSelectedClientId}
              onClearExternalSelectedClientId={() => setExternalSelectedClientId(null)}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onSaveResourceFile={handleSaveResourceFile}
              onConvertLeadToClient={handleConvertLeadToClient}
              onOpenLeadModal={(lead) => setSelectedLead(lead)}
              onCreateProposalForClient={(client) => {
                setProposalDraftSource({ client, kind: 'proposta' });
                setActiveTab('proposals');
              }}
              onPreviewProposal={(proposal) => {
                setExternalPreviewProposalId(proposal.id);
                setActiveTab('proposals');
              }}
              onCreateProjectForClient={(client) => {
                setInitialClientIdForNewProject(client.id);
                setActiveTab('projects');
              }}
              onOpenProject={(projectId) => {
                setExternalSelectedProjectId(projectId);
                setActiveTab('projects');
              }}
              onCreateEventForClient={(client) => {
                setInitialNewEventClientId(client.id);
                setActiveTab('agenda');
              }}
              onOpenSocialModule={() => setActiveTab('social')}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'proposals' && (
            <ProposalsView
              proposals={proposals}
              clients={clients}
              leads={leads}
              niches={niches}
              financialEntries={financialEntries}
              financialRecurrences={financialRecurrences}
              modelTemplates={modelTemplates}
              systemSettings={systemSettings}
              userName={userName}
              cloudPermissionBlocked={proposalsCloudBlocked}
              initialDraftSource={proposalDraftSource}
              onClearInitialDraftSource={() => setProposalDraftSource(null)}
              previewProposalIdExternal={externalPreviewProposalId}
              onClearPreviewProposalIdExternal={() => setExternalPreviewProposalId(null)}
              onSaveProposal={handleSaveProposal}
              onDeleteProposal={handleDeleteProposal}
              onTransitionStatus={handleTransitionProposalStatus}
              onApproveAndSyncClient={handleApproveProposalAndSyncClient}
              onGenerateFinancialForecast={handleGenerateProposalFinancialForecast}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenTemplatesLibrary={() => {
                setResourcesSubTabOverride('templates');
                setActiveTab('templates');
              }}
              onOpenClientFromProposal={(client) => {
                setExternalSelectedClientId(client.id);
                setActiveTab('clients');
              }}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              projects={projects}
              clients={clients}
              proposals={proposals}
              tasks={tasks}
              financialEntries={financialEntries}
              resourceFiles={resourceFiles}
              resourceFolders={resourceFolders}
              resourceCategories={resourceCategories}
              userName={userName}
              cloudPermissionBlocked={projectsCloudBlocked}
              externalSelectedProjectId={externalSelectedProjectId}
              onClearExternalSelectedProjectId={() => setExternalSelectedProjectId(null)}
              initialClientIdForNewProject={initialClientIdForNewProject}
              onClearInitialClientIdForNewProject={() => setInitialClientIdForNewProject(null)}
              onCreateProjectWithTasks={handleCreateProjectWithTasks}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onSaveTask={handleSaveTask}
              onDeleteTask={handleDeleteTask}
              onSaveResourceFile={handleSaveResourceFile}
              onSyncTaskFiles={handleSyncFilesForTask}
              onOpenClient={(clientId) => {
                setExternalSelectedClientId(clientId);
                setActiveTab('clients');
              }}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              projects={projects}
              clients={clients}
              resourceFiles={resourceFiles}
              resourceCategories={resourceCategories}
              resourceFolders={resourceFolders}
              cloudPermissionBlocked={tasksCloudBlocked}
              onSaveTask={handleSaveTask}
              onDeleteTask={handleDeleteTask}
              onSyncTaskFiles={handleSyncFilesForTask}
              onOpenProject={(projectId) => {
                setExternalSelectedProjectId(projectId);
                setActiveTab('projects');
              }}
              onOpenClient={(clientId) => {
                setExternalSelectedClientId(clientId);
                setActiveTab('clients');
              }}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'social' && (
            <SocialView
              channels={socialChannels}
              posts={socialPosts}
              clients={clients}
              proposals={proposals}
              resourceFiles={resourceFiles}
              resourceCategories={resourceCategories}
              resourceFolders={resourceFolders}
              userName={userName}
              cloudPermissionBlocked={socialCloudBlocked}
              onSaveChannel={handleSaveSocialChannel}
              onDeleteChannel={handleDeleteSocialChannel}
              onSavePost={handleSaveSocialPost}
              onDeletePost={handleDeleteSocialPost}
              onSyncSocialPostFiles={handleSyncFilesForSocialPost}
              onOpenClient={(clientId) => {
                setExternalSelectedClientId(clientId);
                setActiveTab('clients');
              }}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView
              entries={financialEntries}
              transactions={financialTransactions}
              categories={financialCategories}
              recurrences={financialRecurrences}
              settings={financialSettings}
              auditLogs={financialAuditLogs}
              clients={clients}
              projects={projects}
              proposals={proposals}
              cloudBlocked={financeCloudBlocked}
              onSaveEntry={handleSaveFinancialEntry}
              onCancelEntry={handleCancelFinancialEntry}
              onSettleEntry={handleSettleFinancialEntry}
              onReverseTransaction={handleReverseFinancialTransaction}
              onSaveRecurrence={handleSaveFinancialRecurrence}
              onChangeRecurrenceStatus={handleChangeFinancialRecurrenceStatus}
              onProcessDueRecurrences={handleProcessDueRecurrences}
              onSaveCategory={handleSaveFinancialCategory}
              onSaveSettings={handleSaveFinancialSettings}
              onOpenClient={(clientId) => {
                setExternalSelectedClientId(clientId);
                setActiveTab('clients');
              }}
              onOpenProposal={(proposalId) => {
                setExternalPreviewProposalId(proposalId);
                setActiveTab('proposals');
              }}
            />
          )}

          {(activeTab === 'documents' || activeTab === 'templates') && (
            <ResourcesCenterView
              initialSubTab={
                resourcesSubTabOverride ||
                (activeTab === 'templates' ? 'templates' : 'overview')
              }
              files={resourceFiles}
              folders={resourceFolders}
              categories={resourceCategories}
              scripts={commercialScripts}
              templates={modelTemplates}
              clients={clients}
              projects={projects}
              tasks={tasks}
              proposals={proposals}
              socialPosts={socialPosts}
              leads={leads}
              niches={niches}
              userName={userName}
              cloudPermissionBlocked={resourcesCloudBlocked}
              onSaveFile={handleSaveResourceFile}
              onDeleteFile={handleDeleteResourceFile}
              onSaveFolder={handleSaveResourceFolder}
              onDeleteFolder={handleDeleteResourceFolder}
              onSaveCategory={handleSaveResourceCategory}
              onDeleteCategory={handleDeleteResourceCategory}
              onSaveScript={handleSaveCommercialScript}
              onDeleteScript={handleDeleteCommercialScript}
              onSaveTemplate={handleSaveModelTemplate}
              onCreateProposalFromTemplate={handleCreateProposalFromTemplate}
              onCreateProjectFromTemplate={handleCreateProjectFromTemplate}
              onCreateTasksFromTemplate={handleCreateTasksFromTemplate}
            />
          )}

          {activeTab === 'productivity' && (
            <AnalyticsHubView
              leads={leads}
              niches={niches}
              clients={clients}
              proposals={proposals}
              projects={projects}
              tasks={tasks}
              agendaEvents={agendaEvents}
              socialChannels={socialChannels}
              socialPosts={socialPosts}
              financialEntries={financialEntries}
              financialTransactions={financialTransactions}
              financialCategories={financialCategories}
              financialRecurrences={financialRecurrences}
              financialSettings={financialSettings}
              financialAuditLogs={financialAuditLogs}
              resourceFiles={resourceFiles}
              savedReports={savedCustomReports}
              preferences={analyticsSettings}
              cloudPermissionBlocked={analyticsCloudBlocked}
              onSaveCustomReport={handleSaveCustomReport}
              onDeleteCustomReport={handleDeleteCustomReport}
              onToggleFavoriteCustomReport={handleToggleFavoriteCustomReport}
              onSavePreferences={handleSaveAnalyticsPreferences}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenClient={(clientId) => {
                setExternalSelectedClientId(clientId);
                setActiveTab('clients');
              }}
              onOpenProject={(projectId) => {
                setExternalSelectedProjectId(projectId);
                setActiveTab('projects');
              }}
            />
          )}

          {activeTab === 'global' && (
            <GlobalAgencyView
              niches={niches}
              leads={leads}
              importedSheets={importedSheets}
              clients={clients}
              proposals={proposals}
              projects={projects}
              tasks={tasks}
              agendaEvents={agendaEvents}
              socialChannels={socialChannels}
              socialPosts={socialPosts}
              financialEntries={financialEntries}
              financialTransactions={financialTransactions}
              financialCategories={financialCategories}
              financialRecurrences={financialRecurrences}
              financialSettings={financialSettings}
              financialAuditLogs={financialAuditLogs}
              resourceFiles={resourceFiles}
              resourceFolders={resourceFolders}
              resourceCategories={resourceCategories}
              commercialScripts={commercialScripts}
              modelTemplates={modelTemplates}
              savedReports={savedCustomReports}
              analyticsSettings={analyticsSettings}
              systemSettings={systemSettings}
              automationSettings={automationRules}
              notifications={notifications}
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

          {activeTab === 'ai_assistant' && (
            <AiAssistantView
              conversations={aiConversations}
              onSaveConversation={handleSaveAiConversation}
              onDeleteConversation={handleDeleteAiConversation}
              onCreateTaskFromAction={handleCreateTaskFromAi}
              onLogAiEvent={(lvl, title, msg) => appendSystemLog(lvl, 'gemini_ia', title, msg)}
              geminiStatus={geminiStatus}
              systemSettings={systemSettings}
              leads={leads}
              niches={niches}
              clients={clients}
              proposals={proposals}
              projects={projects}
              tasks={tasks}
              agendaEvents={agendaEvents}
              socialChannels={socialChannels}
              socialPosts={socialPosts}
              financialEntries={financialEntries}
              financialTransactions={financialTransactions}
              financialCategories={financialCategories}
              financialRecurrences={financialRecurrences}
              financialSettings={financialSettings}
              financialAuditLogs={financialAuditLogs}
              resourceFiles={resourceFiles}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'automations' && (
            <AutomationsView
              rules={automationRules}
              logs={automationLogs}
              onToggleRule={handleToggleAutomationRule}
              onRunRule={(ruleId) => executeAutomationBatch('manual', ruleId)}
              onRunAllActive={() => executeAutomationBatch('manual')}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              systemSettings={systemSettings}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onDismiss={handleDismissNotification}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              userName={userName}
              onUpdateUserName={(name) => setUserName(name)}
              systemSettings={systemSettings}
              onSaveSystemSettings={handleSaveSystemSettings}
              notifications={notifications}
              automationRules={automationRules}
              systemLogs={systemLogs}
              geminiStatus={geminiStatus}
              onRefreshIntegrations={handleRefreshGeminiStatus}
              onRunAllAutomations={() => executeAutomationBatch('manual')}
              niches={niches}
              leads={leads}
              importedSheets={importedSheets}
              clientsCount={clients.length}
              proposalsCount={proposals.length}
              projectsCount={projects.length}
              tasksCount={tasks.length}
              financialEntriesCount={financialEntries.length}
              isCloudSynced={isCloudSynced}
              syncStatus={syncStatus}
              onNavigate={(tab) => setActiveTab(tab)}
              onClearAllContacts={handleClearAllContacts}
            />
          )}

          {unbuiltModuleTabs.length > 0 && unbuiltModuleTabs.includes(activeTab) && null}
        </main>
      </div>

      {syncToast && !syncError && (
        <Toast
          message={syncToast}
          variant="success"
          onDismiss={() => setSyncToast(null)}
        />
      )}

      {/* Lead Detail & Edit Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          niche={activeNiche}
          userName={userName}
          linkedClient={
            findDuplicateClient(clients, {
              originLeadId: selectedLead.id,
              phone: selectedLead.phone,
              companyName: selectedLead.companyName,
            })?.existingClient || null
          }
          linkedProposalsCount={
            proposals.filter((p) => p.leadId === selectedLead.id).length
          }
          commercialScripts={commercialScripts}
          onSaveCommercialScript={handleSaveCommercialScript}
          onOpenCommercialScriptsCenter={() => {
            setSelectedLead(null);
            setResourcesSubTabOverride('scripts');
            setActiveTab('documents');
          }}
          onClose={() => setSelectedLead(null)}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
          onFastWhatsAppContacted={handleFastWhatsAppContacted}
          onOpenScriptForLead={handleOpenScriptForLead}
          onConvertLeadToClient={(leadToConvert) => {
            handleConvertLeadToClient(leadToConvert);
          }}
          onOpenClient={(cli) => {
            setExternalSelectedClientId(cli.id);
            setActiveTab('clients');
          }}
          onCreateProposalForLead={(leadForProposal) => {
            const matchedCli = findDuplicateClient(clients, {
              originLeadId: leadForProposal.id,
              phone: leadForProposal.phone,
              companyName: leadForProposal.companyName,
            })?.existingClient;
            setProposalDraftSource({
              lead: leadForProposal,
              client: matchedCli || null,
              kind: 'proposta',
            });
            setActiveTab('proposals');
          }}
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
