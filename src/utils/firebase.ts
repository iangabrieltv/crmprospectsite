import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocFromServer,
} from 'firebase/firestore';
import { Lead, NicheCampaign, ImportedSheet } from '../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../types/finance';
import {
  CommercialScript,
  ModelTemplate,
  ResourceCategory,
  ResourceFile,
  ResourceFolder,
} from '../types/resources';
import { firebaseConfig, WORKSPACE_ID as CONFIG_WORKSPACE_ID, USE_FIREBASE_EMULATOR } from '../config/env';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with the database ID specified in config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Isolated local emulator wiring (only active when VITE_USE_FIREBASE_EMULATOR=true)
let emulatorsConnected = false;
if (USE_FIREBASE_EMULATOR && !emulatorsConnected && typeof window !== 'undefined') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8088);
    emulatorsConnected = true;
  } catch (err) {
    console.warn('[Firebase Emulator] Falha ao conectar nos emuladores locais:', err);
  }
}

export const WORKSPACE_ID = CONFIG_WORKSPACE_ID;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
  };
  console.error(`[Firestore Error] op: ${operationType}, path: ${path}`, errInfo.error);
  return errInfo;
}

export function isFirestorePermissionDeniedError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return (
    code === 'permission-denied' ||
    msg.toLowerCase().includes('missing or insufficient permissions') ||
    msg.toLowerCase().includes('permission-denied')
  );
}

/**
 * Remove recursivamente todas as propriedades com valor `undefined`,
 * pois o Firestore lança erro se encontrar qualquer campo `undefined` em setDoc ou writeBatch.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as unknown as T;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as T;
  }
  return data;
}

function withVersionMetadata<T extends { schemaVersion?: number; updatedAt?: string }>(data: T): T {
  return {
    ...data,
    schemaVersion: data.schemaVersion ?? 1,
    updatedAt: new Date().toISOString(),
  };
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'workspaces', WORKSPACE_ID));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `workspaces/${WORKSPACE_ID}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// REAL-TIME FIRESTORE SUBSCRIPTIONS
// ---------------------------------------------------------------------------

export function subscribeToNiches(
  onUpdate: (niches: NicheCampaign[]) => void,
  onError?: (error: Error) => void
) {
  const nichesCol = collection(db, 'workspaces', WORKSPACE_ID, 'niches');
  return onSnapshot(
    nichesCol,
    (snapshot) => {
      const list: NicheCampaign[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as NicheCampaign;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/niches`);
      onError?.(err);
    }
  );
}

export function subscribeToLeads(
  onUpdate: (leads: Lead[]) => void,
  onError?: (error: Error) => void
) {
  const leadsCol = collection(db, 'workspaces', WORKSPACE_ID, 'leads');
  return onSnapshot(
    leadsCol,
    (snapshot) => {
      const list: Lead[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Lead;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/leads`);
      onError?.(err);
    }
  );
}

export function subscribeToImportedSheets(
  onUpdate: (sheets: ImportedSheet[]) => void,
  onError?: (error: Error) => void
) {
  const sheetsCol = collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets');
  return onSnapshot(
    sheetsCol,
    (snapshot) => {
      const list: ImportedSheet[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ImportedSheet;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => new Date(b.importedAt || '').getTime() - new Date(a.importedAt || '').getTime());
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/importedSheets`);
      onError?.(err);
    }
  );
}

export function subscribeToClients(
  onUpdate: (clients: Client[]) => void,
  onError?: (error: Error) => void
) {
  const clientsCol = collection(db, 'workspaces', WORKSPACE_ID, 'clients');
  return onSnapshot(
    clientsCol,
    (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Client;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          timeline: Array.isArray(data.timeline) ? data.timeline : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/clients`);
      onError?.(err);
    }
  );
}

export function subscribeToProposals(
  onUpdate: (proposals: ProposalContract[]) => void,
  onError?: (error: Error) => void
) {
  const proposalsCol = collection(db, 'workspaces', WORKSPACE_ID, 'proposals');
  return onSnapshot(
    proposalsCol,
    (snapshot) => {
      const list: ProposalContract[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ProposalContract;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          items: Array.isArray(data.items) ? data.items : [],
          history: Array.isArray(data.history) ? data.history : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/proposals`);
      onError?.(err);
    }
  );
}

export function subscribeToProjects(
  onUpdate: (projects: Project[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'projects');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Project[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Project;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          documents: Array.isArray(data.documents) ? data.documents : [],
          history: Array.isArray(data.history) ? data.history : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/projects`);
      onError?.(err);
    }
  );
}

export function subscribeToTasks(
  onUpdate: (tasks: Task[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'tasks');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Task;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          checklist: Array.isArray(data.checklist) ? data.checklist : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/tasks`);
      onError?.(err);
    }
  );
}

export function subscribeToAgendaEvents(
  onUpdate: (events: AgendaEvent[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'agendaEvents');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AgendaEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AgendaEvent;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => a.date.localeCompare(b.date));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/agendaEvents`);
      onError?.(err);
    }
  );
}

export function subscribeToSocialChannels(
  onUpdate: (channels: SocialChannel[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'socialChannels');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: SocialChannel[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SocialChannel;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/socialChannels`);
      onError?.(err);
    }
  );
}

export function subscribeToSocialPosts(
  onUpdate: (posts: SocialPost[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'socialPosts');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: SocialPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SocialPost;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/socialPosts`);
      onError?.(err);
    }
  );
}

export function subscribeToFinancialEntries(
  onUpdate: (entries: FinancialEntry[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'financialEntries');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FinancialEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FinancialEntry;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/financialEntries`);
      onError?.(err);
    }
  );
}

export function subscribeToFinancialTransactions(
  onUpdate: (transactions: FinancialTransaction[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'financialTransactions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FinancialTransaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FinancialTransaction;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.LIST,
        `workspaces/${WORKSPACE_ID}/financialTransactions`
      );
      onError?.(err);
    }
  );
}

export function subscribeToFinancialCategories(
  onUpdate: (categories: FinancialCategory[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'financialCategories');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FinancialCategory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FinancialCategory;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.LIST,
        `workspaces/${WORKSPACE_ID}/financialCategories`
      );
      onError?.(err);
    }
  );
}

export function subscribeToFinancialRecurrences(
  onUpdate: (recurrences: FinancialRecurrence[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'financialRecurrences');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FinancialRecurrence[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FinancialRecurrence;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => a.nextOccurrenceDate.localeCompare(b.nextOccurrenceDate));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.LIST,
        `workspaces/${WORKSPACE_ID}/financialRecurrences`
      );
      onError?.(err);
    }
  );
}

export function subscribeToFinancialSettings(
  onUpdate: (settings: FinancialSettings | null) => void,
  onError?: (error: Error) => void
) {
  const docRef = doc(db, 'workspaces', WORKSPACE_ID, 'financialSettings', 'default');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onUpdate(null);
        return;
      }
      const data = docSnap.data() as FinancialSettings;
      onUpdate({
        ...data,
        id: data.id || docSnap.id,
        openingBalanceHistory: Array.isArray(data.openingBalanceHistory)
          ? data.openingBalanceHistory
          : [],
        paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
      });
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.GET,
        `workspaces/${WORKSPACE_ID}/financialSettings/default`
      );
      onError?.(err);
    }
  );
}

export function subscribeToFinancialAuditLogs(
  onUpdate: (logs: FinancialAuditLog[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'financialAuditLogs');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FinancialAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FinancialAuditLog;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.LIST,
        `workspaces/${WORKSPACE_ID}/financialAuditLogs`
      );
      onError?.(err);
    }
  );
}

// ---------------------------------------------------------------------------
// LEITURA COMPLETA PARA BACKUP & DIAGNÓSTICO
// ---------------------------------------------------------------------------

export async function fetchFullWorkspaceSnapshot(): Promise<{
  niches: NicheCampaign[];
  leads: Lead[];
  importedSheets: ImportedSheet[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialChannels: SocialChannel[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialRecurrences: FinancialRecurrence[];
  financialSettings: FinancialSettings | null;
  financialAuditLogs: FinancialAuditLog[];
  resourceFiles: ResourceFile[];
  resourceFolders: ResourceFolder[];
  resourceCategories: ResourceCategory[];
  commercialScripts: CommercialScript[];
  modelTemplates: ModelTemplate[];
}> {
  const [
    nichesSnap,
    leadsSnap,
    sheetsSnap,
    clientsRes,
    proposalsRes,
    projectsRes,
    tasksRes,
    eventsRes,
    channelsRes,
    postsRes,
    finEntriesRes,
    finTxRes,
    finCatsRes,
    finRecsRes,
    finSettingsRes,
    finLogsRes,
    resFilesRes,
    resFoldersRes,
    resCatsRes,
    commScriptsRes,
    modelTmplsRes,
  ] = await Promise.all([
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'niches')),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'leads')),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets')),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'clients')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'proposals')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'projects')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'tasks')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'agendaEvents')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'socialChannels')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'socialPosts')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'financialEntries')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'financialTransactions')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'financialCategories')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'financialRecurrences')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'financialSettings')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'financialAuditLogs')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'resourceFiles')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'resourceFolders')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'resourceCategories')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'commercialScripts')).catch(() => null),
    getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'modelTemplates')).catch(() => null),
  ]);

  const niches: NicheCampaign[] = [];
  nichesSnap.forEach((d) => niches.push({ ...(d.data() as NicheCampaign), id: d.id }));

  const leads: Lead[] = [];
  leadsSnap.forEach((d) => leads.push({ ...(d.data() as Lead), id: d.id }));

  const importedSheets: ImportedSheet[] = [];
  sheetsSnap.forEach((d) => importedSheets.push({ ...(d.data() as ImportedSheet), id: d.id }));

  const clients: Client[] = [];
  clientsRes?.forEach((d) => clients.push({ ...(d.data() as Client), id: d.id }));

  const proposals: ProposalContract[] = [];
  proposalsRes?.forEach((d) =>
    proposals.push({ ...(d.data() as ProposalContract), id: d.id })
  );

  const projects: Project[] = [];
  projectsRes?.forEach((d) => projects.push({ ...(d.data() as Project), id: d.id }));

  const tasks: Task[] = [];
  tasksRes?.forEach((d) => tasks.push({ ...(d.data() as Task), id: d.id }));

  const agendaEvents: AgendaEvent[] = [];
  eventsRes?.forEach((d) =>
    agendaEvents.push({ ...(d.data() as AgendaEvent), id: d.id })
  );

  const socialChannels: SocialChannel[] = [];
  channelsRes?.forEach((d) =>
    socialChannels.push({ ...(d.data() as SocialChannel), id: d.id })
  );

  const socialPosts: SocialPost[] = [];
  postsRes?.forEach((d) =>
    socialPosts.push({ ...(d.data() as SocialPost), id: d.id })
  );

  const financialEntries: FinancialEntry[] = [];
  finEntriesRes?.forEach((d) =>
    financialEntries.push({ ...(d.data() as FinancialEntry), id: d.id })
  );

  const financialTransactions: FinancialTransaction[] = [];
  finTxRes?.forEach((d) =>
    financialTransactions.push({ ...(d.data() as FinancialTransaction), id: d.id })
  );

  const financialCategories: FinancialCategory[] = [];
  finCatsRes?.forEach((d) =>
    financialCategories.push({ ...(d.data() as FinancialCategory), id: d.id })
  );

  const financialRecurrences: FinancialRecurrence[] = [];
  finRecsRes?.forEach((d) =>
    financialRecurrences.push({ ...(d.data() as FinancialRecurrence), id: d.id })
  );

  let financialSettings: FinancialSettings | null = null;
  finSettingsRes?.forEach((d) => {
    if (d.id === 'default' || !financialSettings) {
      financialSettings = { ...(d.data() as FinancialSettings), id: d.id };
    }
  });

  const financialAuditLogs: FinancialAuditLog[] = [];
  finLogsRes?.forEach((d) =>
    financialAuditLogs.push({ ...(d.data() as FinancialAuditLog), id: d.id })
  );

  const resourceFiles: ResourceFile[] = [];
  resFilesRes?.forEach((d) =>
    resourceFiles.push({ ...(d.data() as ResourceFile), id: d.id })
  );

  const resourceFolders: ResourceFolder[] = [];
  resFoldersRes?.forEach((d) =>
    resourceFolders.push({ ...(d.data() as ResourceFolder), id: d.id })
  );

  const resourceCategories: ResourceCategory[] = [];
  resCatsRes?.forEach((d) =>
    resourceCategories.push({ ...(d.data() as ResourceCategory), id: d.id })
  );

  const commercialScripts: CommercialScript[] = [];
  commScriptsRes?.forEach((d) =>
    commercialScripts.push({ ...(d.data() as CommercialScript), id: d.id })
  );

  const modelTemplates: ModelTemplate[] = [];
  modelTmplsRes?.forEach((d) =>
    modelTemplates.push({ ...(d.data() as ModelTemplate), id: d.id })
  );

  return {
    niches,
    leads,
    importedSheets,
    clients,
    proposals,
    projects,
    tasks,
    agendaEvents,
    socialChannels,
    socialPosts,
    financialEntries,
    financialTransactions,
    financialCategories,
    financialRecurrences,
    financialSettings,
    financialAuditLogs,
    resourceFiles,
    resourceFolders,
    resourceCategories,
    commercialScripts,
    modelTemplates,
  };
}

// ---------------------------------------------------------------------------
// MUTAÇÕES NO BANCO DE DADOS EM TEMPO REAL
// ---------------------------------------------------------------------------

export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
    const cleanLead = sanitizeForFirestore(withVersionMetadata(lead));
    await setDoc(leadRef, cleanLead, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads/${lead.id}`);
    throw err;
  }
}

export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', leadId);
    await deleteDoc(leadRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads/${leadId}`);
    throw err;
  }
}

export async function syncNicheToFirestore(niche: NicheCampaign): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
    const cleanNiche = sanitizeForFirestore(withVersionMetadata(niche));
    await setDoc(nicheRef, cleanNiche, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches/${niche.id}`);
    throw err;
  }
}

export async function deleteNicheFromFirestore(nicheId: string): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', nicheId);
    await deleteDoc(nicheRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/niches/${nicheId}`);
    throw err;
  }
}

export async function batchDeleteLeadsFromFirestore(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, 'workspaces', WORKSPACE_ID, 'leads', id));
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads (batchDelete)`);
      throw err;
    }
  }
}

export async function reassignLeadsNicheInFirestore(
  leadIds: string[],
  targetNicheId: string
): Promise<void> {
  if (leadIds.length === 0) return;
  const chunkSize = 400;
  const updatedAt = new Date().toISOString();
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'leads', id),
        { nicheId: targetNicheId, updatedAt },
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `workspaces/${WORKSPACE_ID}/leads (reassignNiche)`);
      throw err;
    }
  }
}

export async function syncImportedSheetToFirestore(sheet: ImportedSheet): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheet.id);
    const cleanSheet = sanitizeForFirestore(withVersionMetadata(sheet));
    await setDoc(sheetRef, cleanSheet, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheet.id}`);
    throw err;
  }
}

export async function deleteImportedSheetFromFirestore(sheetId: string): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheetId);
    await deleteDoc(sheetRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheetId}`);
    throw err;
  }
}

export async function batchSyncLeadsToFirestore(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return;

  const chunkSize = 400;
  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const lead of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
      const cleanLead = sanitizeForFirestore(withVersionMetadata(lead));
      batch.set(ref, cleanLead, { merge: true });
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads (batch)`);
      throw err;
    }
  }
}

export async function batchSyncNichesToFirestore(niches: NicheCampaign[]): Promise<void> {
  if (niches.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < niches.length; i += chunkSize) {
    const chunk = niches.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const niche of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
      batch.set(ref, sanitizeForFirestore(withVersionMetadata(niche)), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches (batch)`);
      throw err;
    }
  }
}

export async function batchSyncImportedSheetsToFirestore(sheets: ImportedSheet[]): Promise<void> {
  if (sheets.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < sheets.length; i += chunkSize) {
    const chunk = sheets.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const sheet of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheet.id);
      batch.set(ref, sanitizeForFirestore(withVersionMetadata(sheet)), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/importedSheets (batch)`);
      throw err;
    }
  }
}

export async function syncClientToFirestore(client: Client): Promise<void> {
  try {
    const clientRef = doc(db, 'workspaces', WORKSPACE_ID, 'clients', client.id);
    const cleanClient = sanitizeForFirestore(withVersionMetadata(client));
    await setDoc(clientRef, cleanClient, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/clients/${client.id}`);
    throw err;
  }
}

export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  try {
    const clientRef = doc(db, 'workspaces', WORKSPACE_ID, 'clients', clientId);
    await deleteDoc(clientRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/clients/${clientId}`);
    throw err;
  }
}

export async function batchSyncClientsToFirestore(clients: Client[]): Promise<void> {
  if (clients.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < clients.length; i += chunkSize) {
    const chunk = clients.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const client of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'clients', client.id);
      batch.set(ref, sanitizeForFirestore(withVersionMetadata(client)), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/clients (batch)`);
      throw err;
    }
  }
}

export async function syncProposalToFirestore(proposal: ProposalContract): Promise<void> {
  try {
    const propRef = doc(db, 'workspaces', WORKSPACE_ID, 'proposals', proposal.id);
    const cleanProposal = sanitizeForFirestore(withVersionMetadata(proposal));
    await setDoc(propRef, cleanProposal, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/proposals/${proposal.id}`);
    throw err;
  }
}

export async function deleteProposalFromFirestore(proposalId: string): Promise<void> {
  try {
    const propRef = doc(db, 'workspaces', WORKSPACE_ID, 'proposals', proposalId);
    await deleteDoc(propRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/proposals/${proposalId}`);
    throw err;
  }
}

export async function batchSyncProposalsToFirestore(proposals: ProposalContract[]): Promise<void> {
  if (proposals.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < proposals.length; i += chunkSize) {
    const chunk = proposals.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const proposal of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'proposals', proposal.id);
      batch.set(ref, sanitizeForFirestore(withVersionMetadata(proposal)), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/proposals (batch)`);
      throw err;
    }
  }
}

export async function syncProjectToFirestore(project: Project): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'projects', project.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(project)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/projects/${project.id}`);
    throw err;
  }
}

export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'projects', projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/projects/${projectId}`);
    throw err;
  }
}

export async function batchSyncProjectsToFirestore(projects: Project[]): Promise<void> {
  if (projects.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < projects.length; i += chunkSize) {
    const chunk = projects.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const p of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'projects', p.id),
        sanitizeForFirestore(withVersionMetadata(p)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/projects (batch)`);
      throw err;
    }
  }
}

export async function syncTaskToFirestore(task: Task): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'tasks', task.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(task)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/tasks/${task.id}`);
    throw err;
  }
}

export async function deleteTaskFromFirestore(taskId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'tasks', taskId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/tasks/${taskId}`);
    throw err;
  }
}

export async function batchSyncTasksToFirestore(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const t of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'tasks', t.id),
        sanitizeForFirestore(withVersionMetadata(t)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/tasks (batch)`);
      throw err;
    }
  }
}

export async function syncAgendaEventToFirestore(event: AgendaEvent): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'agendaEvents', event.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(event)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/agendaEvents/${event.id}`);
    throw err;
  }
}

export async function deleteAgendaEventFromFirestore(eventId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'agendaEvents', eventId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/agendaEvents/${eventId}`);
    throw err;
  }
}

export async function batchSyncAgendaEventsToFirestore(events: AgendaEvent[]): Promise<void> {
  if (events.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const ev of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'agendaEvents', ev.id),
        sanitizeForFirestore(withVersionMetadata(ev)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/agendaEvents (batch)`);
      throw err;
    }
  }
}

export async function syncSocialChannelToFirestore(channel: SocialChannel): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'socialChannels', channel.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(channel)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/socialChannels/${channel.id}`);
    throw err;
  }
}

export async function deleteSocialChannelFromFirestore(channelId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'socialChannels', channelId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/socialChannels/${channelId}`);
    throw err;
  }
}

export async function batchSyncSocialChannelsToFirestore(channels: SocialChannel[]): Promise<void> {
  if (channels.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < channels.length; i += chunkSize) {
    const chunk = channels.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const ch of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'socialChannels', ch.id),
        sanitizeForFirestore(withVersionMetadata(ch)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/socialChannels (batch)`);
      throw err;
    }
  }
}

export async function syncSocialPostToFirestore(post: SocialPost): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'socialPosts', post.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(post)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/socialPosts/${post.id}`);
    throw err;
  }
}

export async function deleteSocialPostFromFirestore(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'socialPosts', postId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/socialPosts/${postId}`);
    throw err;
  }
}

export async function batchSyncSocialPostsToFirestore(posts: SocialPost[]): Promise<void> {
  if (posts.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < posts.length; i += chunkSize) {
    const chunk = posts.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const post of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'socialPosts', post.id),
        sanitizeForFirestore(withVersionMetadata(post)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/socialPosts (batch)`);
      throw err;
    }
  }
}

export async function syncFinancialEntryToFirestore(entry: FinancialEntry): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'financialEntries', entry.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(entry)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialEntries/${entry.id}`);
    throw err;
  }
}

export async function batchSyncFinancialEntriesToFirestore(entries: FinancialEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const entry of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'financialEntries', entry.id),
        sanitizeForFirestore(withVersionMetadata(entry)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialEntries (batch)`);
      throw err;
    }
  }
}

export async function syncFinancialTransactionToFirestore(tx: FinancialTransaction): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'financialTransactions', tx.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(tx)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialTransactions/${tx.id}`);
    throw err;
  }
}

export async function batchSyncFinancialTransactionsToFirestore(txs: FinancialTransaction[]): Promise<void> {
  if (txs.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < txs.length; i += chunkSize) {
    const chunk = txs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const tx of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'financialTransactions', tx.id),
        sanitizeForFirestore(withVersionMetadata(tx)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialTransactions (batch)`);
      throw err;
    }
  }
}

export async function syncFinancialCategoryToFirestore(category: FinancialCategory): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'financialCategories', category.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(category)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialCategories/${category.id}`);
    throw err;
  }
}

export async function batchSyncFinancialCategoriesToFirestore(categories: FinancialCategory[]): Promise<void> {
  if (categories.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < categories.length; i += chunkSize) {
    const chunk = categories.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const cat of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'financialCategories', cat.id),
        sanitizeForFirestore(withVersionMetadata(cat)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialCategories (batch)`);
      throw err;
    }
  }
}

export async function syncFinancialRecurrenceToFirestore(recurrence: FinancialRecurrence): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'financialRecurrences', recurrence.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(recurrence)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialRecurrences/${recurrence.id}`);
    throw err;
  }
}

export async function batchSyncFinancialRecurrencesToFirestore(recurrences: FinancialRecurrence[]): Promise<void> {
  if (recurrences.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < recurrences.length; i += chunkSize) {
    const chunk = recurrences.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const rec of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'financialRecurrences', rec.id),
        sanitizeForFirestore(withVersionMetadata(rec)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialRecurrences (batch)`);
      throw err;
    }
  }
}

export async function syncFinancialSettingsToFirestore(settings: FinancialSettings): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'financialSettings', settings.id || 'default');
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(settings)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialSettings/${settings.id || 'default'}`);
    throw err;
  }
}

export async function syncFinancialAuditLogToFirestore(log: FinancialAuditLog): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'financialAuditLogs', log.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(log)));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `workspaces/${WORKSPACE_ID}/financialAuditLogs/${log.id}`);
    throw err;
  }
}

export async function batchSyncFinancialAuditLogsToFirestore(logs: FinancialAuditLog[]): Promise<void> {
  if (logs.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < logs.length; i += chunkSize) {
    const chunk = logs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const log of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'financialAuditLogs', log.id),
        sanitizeForFirestore(withVersionMetadata(log)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/financialAuditLogs (batch)`);
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// ETAPA 5 — MATERIAIS, DOCUMENTOS, SCRIPTS E BIBLIOTECA DE MODELOS
// ---------------------------------------------------------------------------

export function subscribeToResourceFiles(
  onUpdate: (files: ResourceFile[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'resourceFiles');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ResourceFile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ResourceFile;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          tags: Array.isArray(data.tags) ? data.tags : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.uploadedAt || '').getTime() - new Date(a.uploadedAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/resourceFiles`);
      onError?.(err);
    }
  );
}

export function subscribeToResourceFolders(
  onUpdate: (folders: ResourceFolder[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'resourceFolders');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ResourceFolder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ResourceFolder;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/resourceFolders`);
      onError?.(err);
    }
  );
}

export function subscribeToResourceCategories(
  onUpdate: (categories: ResourceCategory[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'resourceCategories');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ResourceCategory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ResourceCategory;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/resourceCategories`);
      onError?.(err);
    }
  );
}

export function subscribeToCommercialScripts(
  onUpdate: (scripts: CommercialScript[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'commercialScripts');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: CommercialScript[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CommercialScript;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          tags: Array.isArray(data.tags) ? data.tags : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/commercialScripts`);
      onError?.(err);
    }
  );
}

export function subscribeToModelTemplates(
  onUpdate: (templates: ModelTemplate[]) => void,
  onError?: (error: Error) => void
) {
  const colRef = collection(db, 'workspaces', WORKSPACE_ID, 'modelTemplates');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ModelTemplate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ModelTemplate;
        list.push({
          ...data,
          id: data.id || docSnap.id,
          tags: Array.isArray(data.tags) ? data.tags : [],
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/modelTemplates`);
      onError?.(err);
    }
  );
}

export async function syncResourceFileToFirestore(file: ResourceFile): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'resourceFiles', file.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(file)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/resourceFiles/${file.id}`);
    throw err;
  }
}

export async function deleteResourceFileFromFirestore(fileId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'resourceFiles', fileId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/resourceFiles/${fileId}`);
    throw err;
  }
}

export async function batchSyncResourceFilesToFirestore(files: ResourceFile[]): Promise<void> {
  if (files.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const f of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'resourceFiles', f.id),
        sanitizeForFirestore(withVersionMetadata(f)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/resourceFiles (batch)`);
      throw err;
    }
  }
}

export async function syncResourceFolderToFirestore(folder: ResourceFolder): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'resourceFolders', folder.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(folder)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/resourceFolders/${folder.id}`);
    throw err;
  }
}

export async function deleteResourceFolderFromFirestore(folderId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'resourceFolders', folderId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/resourceFolders/${folderId}`);
    throw err;
  }
}

export async function batchSyncResourceFoldersToFirestore(folders: ResourceFolder[]): Promise<void> {
  if (folders.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < folders.length; i += chunkSize) {
    const chunk = folders.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const f of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'resourceFolders', f.id),
        sanitizeForFirestore(withVersionMetadata(f)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/resourceFolders (batch)`);
      throw err;
    }
  }
}

export async function syncResourceCategoryToFirestore(category: ResourceCategory): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'resourceCategories', category.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(category)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/resourceCategories/${category.id}`);
    throw err;
  }
}

export async function deleteResourceCategoryFromFirestore(categoryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'resourceCategories', categoryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/resourceCategories/${categoryId}`);
    throw err;
  }
}

export async function batchSyncResourceCategoriesToFirestore(categories: ResourceCategory[]): Promise<void> {
  if (categories.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < categories.length; i += chunkSize) {
    const chunk = categories.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const c of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'resourceCategories', c.id),
        sanitizeForFirestore(withVersionMetadata(c)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/resourceCategories (batch)`);
      throw err;
    }
  }
}

export async function syncCommercialScriptToFirestore(script: CommercialScript): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'commercialScripts', script.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(script)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/commercialScripts/${script.id}`);
    throw err;
  }
}

export async function deleteCommercialScriptFromFirestore(scriptId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'commercialScripts', scriptId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/commercialScripts/${scriptId}`);
    throw err;
  }
}

export async function batchSyncCommercialScriptsToFirestore(scripts: CommercialScript[]): Promise<void> {
  if (scripts.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < scripts.length; i += chunkSize) {
    const chunk = scripts.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const s of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'commercialScripts', s.id),
        sanitizeForFirestore(withVersionMetadata(s)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/commercialScripts (batch)`);
      throw err;
    }
  }
}

export async function syncModelTemplateToFirestore(template: ModelTemplate): Promise<void> {
  try {
    const ref = doc(db, 'workspaces', WORKSPACE_ID, 'modelTemplates', template.id);
    await setDoc(ref, sanitizeForFirestore(withVersionMetadata(template)), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/modelTemplates/${template.id}`);
    throw err;
  }
}

export async function deleteModelTemplateFromFirestore(templateId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', WORKSPACE_ID, 'modelTemplates', templateId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/modelTemplates/${templateId}`);
    throw err;
  }
}

export async function batchSyncModelTemplatesToFirestore(templates: ModelTemplate[]): Promise<void> {
  if (templates.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < templates.length; i += chunkSize) {
    const chunk = templates.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const t of chunk) {
      batch.set(
        doc(db, 'workspaces', WORKSPACE_ID, 'modelTemplates', t.id),
        sanitizeForFirestore(withVersionMetadata(t)),
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/modelTemplates (batch)`);
      throw err;
    }
  }
}

/**
 * Inicializa nicho padrão no Firestore apenas se a coleção estiver vazia (nunca sobrescreve existentes).
 */
export async function seedFirestoreIfEmpty(
  initialNiches: NicheCampaign[],
  _initialLeads: Lead[] = []
): Promise<void> {
  try {
    const nichesSnap = await getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'niches'));
    if (nichesSnap.empty) {
      const batch = writeBatch(db);
      for (const niche of initialNiches) {
        const nRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
        batch.set(nRef, sanitizeForFirestore(withVersionMetadata(niche)));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/seed`);
  }
}

/**
 * Remove todos os contatos da nuvem (somente via confirmação explícita manual).
 */
export async function clearAllLeadsFromFirestore(): Promise<number> {
  try {
    const leadsCol = collection(db, 'workspaces', WORKSPACE_ID, 'leads');
    const snap = await getDocs(leadsCol);
    if (snap.empty) return 0;

    const count = snap.size;
    const chunkSize = 400;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads (clearAll)`);
    throw err;
  }
}

/**
 * Remove todas as planilhas importadas da nuvem (somente via confirmação explícita manual).
 */
export async function clearAllImportedSheetsFromFirestore(): Promise<number> {
  try {
    const sheetsCol = collection(db, 'workspaces', WORKSPACE_ID, 'importedSheets');
    const snap = await getDocs(sheetsCol);
    if (snap.empty) return 0;

    const count = snap.size;
    const chunkSize = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets (clearAll)`);
    throw err;
  }
}

/**
 * @deprecated Neutralizada na Etapa 0: não exclui mais nichos automaticamente por palavra-chave.
 * Mantida apenas como função inócua de compatibilidade para evitar que chamadas legadas apaguem dados reais.
 */
export async function purgeOldSampleNichesFromFirestore(
  _cleanBaselineNiches: NicheCampaign[]
): Promise<void> {
  console.warn(
    '[Proteção de Dados] purgeOldSampleNichesFromFirestore foi desativada para proteger campanhas comerciais reais.'
  );
}

/**
 * Reseta o banco de dados inteiro para o estado inicial limpo (somente via confirmação explícita manual).
 */
export async function resetFirestoreToCleanBaseline(
  cleanBaselineNiches: NicheCampaign[]
): Promise<void> {
  try {
    await clearAllLeadsFromFirestore();
    await clearAllImportedSheetsFromFirestore();

    const nichesCol = collection(db, 'workspaces', WORKSPACE_ID, 'niches');
    const snap = await getDocs(nichesCol);
    const chunkSize = 400;
    for (let i = 0; i < snap.docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + chunkSize)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    const seedBatch = writeBatch(db);
    for (const clean of cleanBaselineNiches) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'niches', clean.id);
      seedBatch.set(ref, sanitizeForFirestore(withVersionMetadata(clean)));
    }
    await seedBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/resetToClean`);
    throw err;
  }
}
