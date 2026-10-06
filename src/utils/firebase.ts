import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { Lead, NicheCampaign, ImportedSheet } from '../types/crm';
import firebaseConfigData from '../firebase-config';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfigData) : getApp();

// CRITICAL: Initialize Firestore with the database ID specified in config
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);
export const auth = getAuth(app);

export const WORKSPACE_ID = 'adm_equipeie';

// Helper error handler conforming to skill requirements
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  console.error(`[Firestore Error] op: ${operationType}, path: ${path}`, errMessage);
}

/**
 * Remove recursivamente todas as propriedades com valor `undefined`,
 * pois o Firestore lança erro se encontrar qualquer campo `undefined` em setDoc ou writeBatch.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as any;
  }
  return data;
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

/**
 * Escuta em tempo real todas as campanhas/nichos do workspace
 */
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
        list.push(docSnap.data() as NicheCampaign);
      });
      // Sort by creation date
      list.sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/niches`);
      onError?.(err);
    }
  );
}

/**
 * Escuta em tempo real todos os leads do workspace (Kanban + Pipeline)
 * Permite sincronização instantânea entre múltiplos dispositivos.
 */
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
        list.push(docSnap.data() as Lead);
      });
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `workspaces/${WORKSPACE_ID}/leads`);
      onError?.(err);
    }
  );
}

/**
 * Escuta em tempo real o histórico de planilhas importadas
 */
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
        list.push(docSnap.data() as ImportedSheet);
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

// ---------------------------------------------------------------------------
// MUTAÇÕES NO BANCO DE DADOS EM TEMPO REAL
// ---------------------------------------------------------------------------

/**
 * Salva ou atualiza um lead no Firestore (com sanitização contra undefined)
 */
export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
    const cleanLead = sanitizeForFirestore(lead);
    await setDoc(leadRef, cleanLead, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads/${lead.id}`);
    throw err;
  }
}

/**
 * Remove um lead do Firestore
 */
export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', leadId);
    await deleteDoc(leadRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/leads/${leadId}`);
    throw err;
  }
}

/**
 * Salva ou atualiza um nicho no Firestore (com sanitização contra undefined)
 */
export async function syncNicheToFirestore(niche: NicheCampaign): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
    const cleanNiche = sanitizeForFirestore(niche);
    await setDoc(nicheRef, cleanNiche, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/niches/${niche.id}`);
    throw err;
  }
}

/**
 * Remove um nicho do Firestore
 */
export async function deleteNicheFromFirestore(nicheId: string): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', nicheId);
    await deleteDoc(nicheRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/niches/${nicheId}`);
    throw err;
  }
}

/**
 * Salva o registro de uma planilha importada no Firestore
 */
export async function syncImportedSheetToFirestore(sheet: ImportedSheet): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheet.id);
    const cleanSheet = sanitizeForFirestore(sheet);
    await setDoc(sheetRef, cleanSheet, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheet.id}`);
    throw err;
  }
}

/**
 * Remove o registro de uma planilha importada do Firestore
 */
export async function deleteImportedSheetFromFirestore(sheetId: string): Promise<void> {
  try {
    const sheetRef = doc(db, 'workspaces', WORKSPACE_ID, 'importedSheets', sheetId);
    await deleteDoc(sheetRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${WORKSPACE_ID}/importedSheets/${sheetId}`);
    throw err;
  }
}

/**
 * Importa múltiplos leads em lote (batch) para salvar na nuvem
 * Sanitiza cada documento para garantir que nenhum campo undefined interrompa o commit.
 */
export async function batchSyncLeadsToFirestore(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return;

  // Firestore batches have limit of 500 writes
  const chunkSize = 400;
  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const lead of chunk) {
      const ref = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
      const cleanLead = sanitizeForFirestore(lead);
      batch.set(ref, cleanLead, { merge: true });
    }

    try {
      await batch.commit();
      console.log(`[Firestore] ${chunk.length} leads salvos com sucesso na nuvem.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/leads (batch)`);
      throw err;
    }
  }
}

/**
 * Inicializa dados iniciais no Firestore se o banco estiver vazio
 */
export async function seedFirestoreIfEmpty(
  initialNiches: NicheCampaign[],
  initialLeads: Lead[]
): Promise<void> {
  try {
    const nichesSnap = await getDocs(collection(db, 'workspaces', WORKSPACE_ID, 'niches'));
    if (nichesSnap.empty) {
      const batch = writeBatch(db);
      for (const niche of initialNiches) {
        const nRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
        batch.set(nRef, sanitizeForFirestore(niche));
      }
      for (const lead of initialLeads) {
        const lRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
        batch.set(lRef, sanitizeForFirestore(lead));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/seed`);
  }
}
