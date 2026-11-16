export interface EmulatorProbeResult {
  ok: boolean;
  service: 'auth' | 'firestore';
  url: string;
  status?: number;
  contentType?: string | null;
  reason?: string;
}

export interface EmulatorsHealthReport {
  ok: boolean;
  auth: EmulatorProbeResult;
  firestore: EmulatorProbeResult;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readStrictJsonResponse(
  res: Response,
  service: 'auth' | 'firestore',
  url: string
): Promise<{ ok: true; data: Record<string, unknown>; contentType: string } | { ok: false; result: EmulatorProbeResult }> {
  const contentType = (res.headers.get('content-type') || '').trim();
  const normalizedCt = contentType.toLowerCase();

  if (!res.ok) {
    return {
      ok: false,
      result: {
        ok: false,
        service,
        url,
        status: res.status,
        contentType: contentType || null,
        reason: `HTTP ${res.status} retornado pelo endpoint do emulador ${service}.`,
      },
    };
  }

  if (!normalizedCt.includes('application/json')) {
    return {
      ok: false,
      result: {
        ok: false,
        service,
        url,
        status: res.status,
        contentType: contentType || null,
        reason: `Content-Type inválido (${contentType || 'ausente'}): esperado application/json, não HTML/texto.`,
      },
    };
  }

  let rawBody = '';
  try {
    rawBody = await res.text();
  } catch (err) {
    return {
      ok: false,
      result: {
        ok: false,
        service,
        url,
        status: res.status,
        contentType,
        reason: `Falha ao ler corpo HTTP: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (err) {
    return {
      ok: false,
      result: {
        ok: false,
        service,
        url,
        status: res.status,
        contentType,
        reason: `JSON inválido retornado pelo servidor (${err instanceof Error ? err.message : 'parse error'}).`,
      },
    };
  }

  if (!isPlainJsonObject(parsed)) {
    return {
      ok: false,
      result: {
        ok: false,
        service,
        url,
        status: res.status,
        contentType,
        reason: 'Estrutura JSON inesperada (esperado objeto JSON do Firebase Emulator).',
      },
    };
  }

  return { ok: true, data: parsed, contentType };
}

/**
 * Valida estritamente o Firebase Auth Emulator (`GET /`).
 * O Auth Emulator oficial responde HTTP 200 application/json com `{ authEmulator: { ready: true, ... } }`.
 */
export async function checkAuthEmulatorHealth(
  authBaseUrl: string,
  fetchFn: FetchLike = fetch
): Promise<EmulatorProbeResult> {
  const url = `${normalizeBaseUrl(authBaseUrl)}/`;
  let res: Response;
  try {
    res = await fetchFn(url, { method: 'GET' });
  } catch (err) {
    return {
      ok: false,
      service: 'auth',
      url,
      reason: `Auth Emulator inacessível: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const checked = await readStrictJsonResponse(res, 'auth', url);
  if (!checked.ok) {
    return checked.result;
  }

  const authEmulatorObj = checked.data.authEmulator;
  if (!isPlainJsonObject(authEmulatorObj) || authEmulatorObj.ready !== true) {
    return {
      ok: false,
      service: 'auth',
      url,
      status: res.status,
      contentType: checked.contentType,
      reason:
        'Porta respondeu JSON, mas não corresponde ao Firebase Auth Emulator (authEmulator.ready !== true).',
    };
  }

  return {
    ok: true,
    service: 'auth',
    url,
    status: res.status,
    contentType: checked.contentType,
  };
}

/**
 * Valida estritamente o Cloud Firestore Emulator (`GET /emulator/v1/projects/:projectId:ruleCoverage`).
 * O Firestore Emulator oficial (v1.x+) responde HTTP 200 application/json com objeto contendo `rules`/`report`.
 */
export async function checkFirestoreEmulatorHealth(
  firestoreBaseUrl: string,
  projectId: string,
  fetchFn: FetchLike = fetch
): Promise<EmulatorProbeResult> {
  const cleanBase = normalizeBaseUrl(firestoreBaseUrl);
  const url = `${cleanBase}/emulator/v1/projects/${encodeURIComponent(projectId)}:ruleCoverage`;

  let res: Response;
  try {
    res = await fetchFn(url, { method: 'GET' });
  } catch (err) {
    return {
      ok: false,
      service: 'firestore',
      url,
      reason: `Firestore Emulator inacessível: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const checked = await readStrictJsonResponse(res, 'firestore', url);
  if (!checked.ok) {
    return checked.result;
  }

  const hasRulesObj = isPlainJsonObject(checked.data.rules);
  const hasReportObj = isPlainJsonObject(checked.data.report);
  const hasDatabasesArr = Array.isArray(checked.data.databases);

  if (!hasRulesObj && !hasReportObj && !hasDatabasesArr) {
    return {
      ok: false,
      service: 'firestore',
      url,
      status: res.status,
      contentType: checked.contentType,
      reason:
        'Porta respondeu JSON, mas não corresponde ao Firestore Emulator (estrutura rules/report ausente).',
    };
  }

  return {
    ok: true,
    service: 'firestore',
    url,
    status: res.status,
    contentType: checked.contentType,
  };
}

export async function verifyEmulatorsHealth(params: {
  authBaseUrl: string;
  firestoreBaseUrl: string;
  projectId: string;
  fetchFn?: FetchLike;
}): Promise<EmulatorsHealthReport> {
  const fetchFn = params.fetchFn || fetch;
  const [auth, firestore] = await Promise.all([
    checkAuthEmulatorHealth(params.authBaseUrl, fetchFn),
    checkFirestoreEmulatorHealth(params.firestoreBaseUrl, params.projectId, fetchFn),
  ]);

  return {
    ok: auth.ok && firestore.ok,
    auth,
    firestore,
  };
}

export async function assertEmulatorsRunning(params: {
  authBaseUrl: string;
  firestoreBaseUrl: string;
  projectId: string;
  fetchFn?: FetchLike;
}): Promise<EmulatorsHealthReport> {
  const report = await verifyEmulatorsHealth(params);
  if (!report.ok) {
    const details = [
      `auth=${report.auth.ok ? 'OK' : `FAIL (${report.auth.reason})`}`,
      `firestore=${report.firestore.ok ? 'OK' : `FAIL (${report.firestore.reason})`}`,
    ].join('; ');

    throw new Error(
      `Firebase Auth/Firestore Emulator inválido ou inacessível [${details}]. ` +
        `Execute exclusivamente com os emuladores ativos: ` +
        `'firebase emulators:exec --project ${params.projectId} --only auth,firestore "npm run test:rules"'.`
    );
  }
  return report;
}
