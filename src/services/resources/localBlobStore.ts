// Cofre binário local em IndexedDB (com fallback em memória para testes Node)
// Garante que payloads binários de arquivos nunca poluam documentos do Firestore.

const DB_NAME = 'kaizen_resource_blobs_v1';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

interface StoredBlobRecord {
  key: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  buffer: ArrayBuffer;
  savedAt: string;
}

const memoryFallbackStore = new Map<string, StoredBlobRecord>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openBlobDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB indisponível neste ambiente.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Falha ao abrir IndexedDB de arquivos.'));
  });
}

export function computeBufferFingerprint(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  const step = bytes.length > 65536 ? Math.floor(bytes.length / 16384) : 1;
  for (let i = 0; i < bytes.length; i += step) {
    const b = bytes[i];
    h1 ^= b;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= b ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `fnv-${bytes.length}-${p1}${p2}`;
}

export async function saveLocalBlob(params: {
  key: string;
  data: Blob | ArrayBuffer | Uint8Array;
  mimeType: string;
}): Promise<{ checksum: string; sizeBytes: number }> {
  let buffer: ArrayBuffer;
  if (params.data instanceof ArrayBuffer) {
    buffer = params.data.slice(0);
  } else if (params.data instanceof Uint8Array) {
    buffer = params.data.buffer.slice(
      params.data.byteOffset,
      params.data.byteOffset + params.data.byteLength
    ) as ArrayBuffer;
  } else {
    buffer = await params.data.arrayBuffer();
  }

  const checksum = computeBufferFingerprint(buffer);
  const record: StoredBlobRecord = {
    key: params.key,
    mimeType: params.mimeType || 'application/octet-stream',
    sizeBytes: buffer.byteLength,
    checksum,
    buffer,
    savedAt: new Date().toISOString(),
  };

  memoryFallbackStore.set(params.key, record);

  if (!hasIndexedDb()) {
    return { checksum, sizeBytes: record.sizeBytes };
  }

  const db = await openBlobDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error('Erro ao gravar arquivo no cofre local.'));
    });
  } finally {
    db.close();
  }

  return { checksum, sizeBytes: record.sizeBytes };
}

export async function loadLocalBlob(
  key: string
): Promise<{ blob: Blob; mimeType: string; sizeBytes: number; checksum: string } | null> {
  if (!key) return null;

  const fromMem = memoryFallbackStore.get(key);
  if (fromMem) {
    return {
      blob: new Blob([fromMem.buffer], { type: fromMem.mimeType }),
      mimeType: fromMem.mimeType,
      sizeBytes: fromMem.sizeBytes,
      checksum: fromMem.checksum,
    };
  }

  if (!hasIndexedDb()) {
    return null;
  }

  const db = await openBlobDatabase();
  try {
    const rec = await new Promise<StoredBlobRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as StoredBlobRecord | undefined);
      req.onerror = () => reject(req.error || new Error('Erro ao ler arquivo do cofre local.'));
    });

    if (!rec) return null;
    return {
      blob: new Blob([rec.buffer], { type: rec.mimeType }),
      mimeType: rec.mimeType,
      sizeBytes: rec.sizeBytes,
      checksum: rec.checksum,
    };
  } finally {
    db.close();
  }
}

export async function deleteLocalBlob(key: string): Promise<void> {
  if (!key) return;
  memoryFallbackStore.delete(key);
  if (!hasIndexedDb()) return;

  const db = await openBlobDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Erro ao remover arquivo do cofre local.'));
    });
  } finally {
    db.close();
  }
}

export function clearMemoryBlobStoreForTests(): void {
  memoryFallbackStore.clear();
}
