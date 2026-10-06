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
import { Lead, NicheCampaign } from '../types/crm';
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

// ---------------------------------------------------------------------------
// MUTAÇÕES NO BANCO DE DADOS EM TEMPO REAL
// ---------------------------------------------------------------------------

/**
 * Salva ou atualiza um lead no Firestore
 */
export async function syncLeadToFirestore(lead: Lead): Promise<void> {
  try {
    const leadRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
    await setDoc(leadRef, lead, { merge: true });
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
 * Salva ou atualiza um nicho no Firestore
 */
export async function syncNicheToFirestore(niche: NicheCampaign): Promise<void> {
  try {
    const nicheRef = doc(db, 'workspaces', WORKSPACE_ID, 'niches', niche.id);
    await setDoc(nicheRef, niche, { merge: true });
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
 * Importa múltiplos leads em lote (batch) para salvar na nuvem
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
      batch.set(ref, lead, { merge: true });
    }

    try {
      await batch.commit();
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
        batch.set(nRef, niche);
      }
      for (const lead of initialLeads) {
        const lRef = doc(db, 'workspaces', WORKSPACE_ID, 'leads', lead.id);
        batch.set(lRef, lead);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${WORKSPACE_ID}/seed`);
  }
}
