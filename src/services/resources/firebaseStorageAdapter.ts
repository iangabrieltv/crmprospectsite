import { getApps, getApp, initializeApp } from 'firebase/app';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { firebaseConfig, WORKSPACE_ID } from '../../config/env';
import { ResourceFile, ResourceStorageProvider } from '../../types/resources';
import { deleteLocalBlob, loadLocalBlob, saveLocalBlob } from './localBlobStore';

export type StorageUploadMode = 'auto' | 'require_cloud';

export interface StorageUploadInput {
  fileId: string;
  sanitizedOriginalName: string;
  mimeType: string;
  data: Blob | File | ArrayBuffer | Uint8Array;
  mode?: StorageUploadMode;
  onProgress?: (percent: number) => void;
}

export interface StorageUploadResult {
  ok: boolean;
  storagePath: string;
  storageProvider: ResourceStorageProvider;
  downloadUrl?: string;
  localBlobKey?: string;
  checksum?: string;
  sizeBytes?: number;
  cloudError?: string;
  notice?: string;
}

export interface StorageDriver {
  uploadToCloud(params: {
    storagePath: string;
    data: Blob | Uint8Array | ArrayBuffer;
    mimeType: string;
    onProgress?: (percent: number) => void;
  }): Promise<{ downloadUrl: string }>;
  downloadFromCloud(storagePath: string): Promise<Blob>;
  deleteFromCloud(storagePath: string): Promise<void>;
}

function getFirebaseStorageInstance() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getStorage(app);
}

export const defaultFirebaseStorageDriver: StorageDriver = {
  async uploadToCloud({ storagePath, data, mimeType, onProgress }) {
    if (!firebaseConfig.storageBucket) {
      throw new Error('Bucket do Firebase Storage não configurado neste ambiente.');
    }
    const storage = getFirebaseStorageInstance();
    const storageRef = ref(storage, storagePath);
    const bytesPayload =
      data instanceof Blob ? data : new Blob([data as BlobPart], { type: mimeType });

    const task = uploadBytesResumable(storageRef, bytesPayload, {
      contentType: mimeType,
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            onProgress(
              Math.min(100, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
            );
          }
        },
        (error) => reject(error),
        () => resolve()
      );
    });

    const downloadUrl = await getDownloadURL(task.snapshot.ref);
    return { downloadUrl };
  },

  async downloadFromCloud(storagePath: string) {
    const storage = getFirebaseStorageInstance();
    return getBlob(ref(storage, storagePath));
  },

  async deleteFromCloud(storagePath: string) {
    const storage = getFirebaseStorageInstance();
    await deleteObject(ref(storage, storagePath));
  },
};

export function buildResourceStoragePath(fileId: string, sanitizedOriginalName: string): string {
  return `workspaces/${WORKSPACE_ID}/resources/${fileId}/${sanitizedOriginalName}`;
}

export function isCloudStorageConfigured(): boolean {
  return Boolean(firebaseConfig.storageBucket && firebaseConfig.storageBucket.trim().length > 0);
}

/**
 * Executa upload real para Firebase Storage quando disponível/permitido.
 * Em ambiente de desenvolvimento onde storage.rules remotas não foram publicadas ou o bucket
 * retorna erro de permissão/CORS/offline, preserva o binário no cofre local IndexedDB (nunca no Firestore)
 * e reporta com total honestidade o `storageProvider` real utilizado (`firebase_storage` vs `indexeddb_dev`).
 */
export async function uploadResourceBinary(
  input: StorageUploadInput,
  driver: StorageDriver = defaultFirebaseStorageDriver
): Promise<StorageUploadResult> {
  const storagePath = buildResourceStoragePath(input.fileId, input.sanitizedOriginalName);
  const localBlobKey = `blob-${input.fileId}`;
  const mode: StorageUploadMode = input.mode || 'auto';

  const normalizedData =
    input.data instanceof Blob
      ? input.data
      : input.data instanceof Uint8Array
      ? (input.data.buffer.slice(
          input.data.byteOffset,
          input.data.byteOffset + input.data.byteLength
        ) as ArrayBuffer)
      : input.data;

  // Sempre salva uma cópia local para pré-visualização imediata e fallback de dev
  const localSaved = await saveLocalBlob({
    key: localBlobKey,
    data: normalizedData,
    mimeType: input.mimeType,
  });

  if (isCloudStorageConfigured() && typeof window !== 'undefined') {
    try {
      const cloud = await driver.uploadToCloud({
        storagePath,
        data: normalizedData,
        mimeType: input.mimeType,
        onProgress: input.onProgress,
      });
      return {
        ok: true,
        storagePath,
        storageProvider: 'firebase_storage',
        downloadUrl: cloud.downloadUrl,
        localBlobKey,
        checksum: localSaved.checksum,
        sizeBytes: localSaved.sizeBytes,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (mode === 'require_cloud') {
        await deleteLocalBlob(localBlobKey);
        return {
          ok: false,
          storagePath,
          storageProvider: 'firebase_storage',
          cloudError: msg,
        };
      }
      return {
        ok: true,
        storagePath,
        storageProvider: 'indexeddb_dev',
        localBlobKey,
        checksum: localSaved.checksum,
        sizeBytes: localSaved.sizeBytes,
        cloudError: msg,
        notice:
          'Firebase Storage indisponível no ambiente atual (regras remotas não publicadas). O arquivo foi armazenado no cofre local do navegador (IndexedDB) e seus metadados salvos no Firestore.',
      };
    }
  }

  if (mode === 'require_cloud') {
    await deleteLocalBlob(localBlobKey);
    return {
      ok: false,
      storagePath,
      storageProvider: 'firebase_storage',
      cloudError: 'Firebase Storage não inicializado fora do navegador ou bucket ausente.',
    };
  }

  return {
    ok: true,
    storagePath,
    storageProvider: 'indexeddb_dev',
    localBlobKey,
    checksum: localSaved.checksum,
    sizeBytes: localSaved.sizeBytes,
    notice:
      'Armazenado localmente no cofre IndexedDB do navegador (ambiente de desenvolvimento sem publicação remota de storage.rules).',
  };
}

/**
 * Carrega o binário real de um arquivo (cofre local IndexedDB ou Firebase Storage).
 */
export async function resolveResourceBlob(
  file: ResourceFile,
  driver: StorageDriver = defaultFirebaseStorageDriver
): Promise<{ blob: Blob | null; source: ResourceStorageProvider | 'missing'; error?: string }> {
  if (file.localBlobKey) {
    const local = await loadLocalBlob(file.localBlobKey);
    if (local) {
      return { blob: local.blob, source: file.storageProvider || 'indexeddb_dev' };
    }
  }

  if (file.storageProvider === 'firebase_storage' && file.storagePath) {
    try {
      const blob = await driver.downloadFromCloud(file.storagePath);
      return { blob, source: 'firebase_storage' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        blob: null,
        source: 'missing',
        error: `Falha ao baixar do Firebase Storage: ${msg}`,
      };
    }
  }

  if (file.storageProvider === 'external_link' && file.downloadUrl) {
    return { blob: null, source: 'external_link' };
  }

  return {
    blob: null,
    source: 'missing',
    error:
      'Conteúdo binário local não encontrado neste navegador. Caso tenha sido enviado em outro dispositivo sem publicação do Storage, reenvie o arquivo ou vincule uma URL externa.',
  };
}

export async function removeResourceBinary(
  file: ResourceFile,
  driver: StorageDriver = defaultFirebaseStorageDriver
): Promise<void> {
  if (file.localBlobKey) {
    await deleteLocalBlob(file.localBlobKey).catch(() => undefined);
  }
  if (file.storageProvider === 'firebase_storage' && file.storagePath) {
    await driver.deleteFromCloud(file.storagePath).catch(() => undefined);
  }
}
