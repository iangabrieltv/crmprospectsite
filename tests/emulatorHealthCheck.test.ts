import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  assertEmulatorsRunning,
  verifyEmulatorsHealth,
} from '../src/services/emulatorHealthCheck';

async function startTempServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function authSuccessHandler(_req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      authEmulator: {
        ready: true,
        docs: 'https://firebase.google.com/docs/emulator-suite',
        apiSpec: '/emulator/openapi.json',
      },
    })
  );
}

function firestoreSuccessHandler(req: http.IncomingMessage, res: http.ServerResponse) {
  if ((req.url || '').includes(':ruleCoverage')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rules: { files: [{ name: 'firestore.rules' }] } }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

test('1. Ambos emuladores ativos com JSON oficial passam sem erros', async () => {
  const authSrv = await startTempServer(authSuccessHandler);
  const fsSrv = await startTempServer(firestoreSuccessHandler);
  try {
    const report = await assertEmulatorsRunning({
      authBaseUrl: authSrv.baseUrl,
      firestoreBaseUrl: fsSrv.baseUrl,
      projectId: 'kaizen-rules-test',
    });
    assert.equal(report.ok, true);
    assert.equal(report.auth.ok, true);
    assert.equal(report.firestore.ok, true);
  } finally {
    await Promise.all([authSrv.close(), fsSrv.close()]);
  }
});

test('2. Apenas Firestore ativo (Auth indisponível) deve falhar', async () => {
  const fsSrv = await startTempServer(firestoreSuccessHandler);
  // Reserva porta e fecha imediatamente para garantir conexão recusada
  const deadSrv = await startTempServer((_req, res) => res.end());
  const deadUrl = deadSrv.baseUrl;
  await deadSrv.close();

  try {
    await assert.rejects(
      () =>
        assertEmulatorsRunning({
          authBaseUrl: deadUrl,
          firestoreBaseUrl: fsSrv.baseUrl,
          projectId: 'kaizen-rules-test',
        }),
      /auth=FAIL/
    );
  } finally {
    await fsSrv.close();
  }
});

test('3. Apenas Auth ativo (Firestore indisponível) deve falhar', async () => {
  const authSrv = await startTempServer(authSuccessHandler);
  const deadSrv = await startTempServer((_req, res) => res.end());
  const deadUrl = deadSrv.baseUrl;
  await deadSrv.close();

  try {
    await assert.rejects(
      () =>
        assertEmulatorsRunning({
          authBaseUrl: authSrv.baseUrl,
          firestoreBaseUrl: deadUrl,
          projectId: 'kaizen-rules-test',
        }),
      /firestore=FAIL/
    );
  } finally {
    await authSrv.close();
  }
});

test('4. Ambos emuladores indisponíveis deve falhar explicitamente', async () => {
  const deadA = await startTempServer((_req, res) => res.end());
  const deadB = await startTempServer((_req, res) => res.end());
  const urlA = deadA.baseUrl;
  const urlB = deadB.baseUrl;
  await Promise.all([deadA.close(), deadB.close()]);

  const report = await verifyEmulatorsHealth({
    authBaseUrl: urlA,
    firestoreBaseUrl: urlB,
    projectId: 'kaizen-rules-test',
  });
  assert.equal(report.ok, false);
  assert.equal(report.auth.ok, false);
  assert.equal(report.firestore.ok, false);
});

test('5. Porta ocupada por servidor HTTP comum (JSON genérico não-emulador) deve ser rejeitada', async () => {
  const fakeAuth = await startTempServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'generic-api' }));
  });
  const fakeFs = await startTempServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, db: 'not-firestore-emulator' }));
  });

  try {
    const report = await verifyEmulatorsHealth({
      authBaseUrl: fakeAuth.baseUrl,
      firestoreBaseUrl: fakeFs.baseUrl,
      projectId: 'kaizen-rules-test',
    });
    assert.equal(report.ok, false);
    assert.equal(report.auth.ok, false);
    assert.match(report.auth.reason || '', /não corresponde ao Firebase Auth Emulator/i);
    assert.equal(report.firestore.ok, false);
    assert.match(report.firestore.reason || '', /não corresponde ao Firestore Emulator/i);
  } finally {
    await Promise.all([fakeAuth.close(), fakeFs.close()]);
  }
});

test('6. Resposta HTML 200 OK (ex: nginx / Vite SPA fallback na porta 8080) deve ser rejeitada', async () => {
  const htmlSrv = await startTempServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><body>Kaizen CRM SPA</body></html>');
  });

  try {
    const report = await verifyEmulatorsHealth({
      authBaseUrl: htmlSrv.baseUrl,
      firestoreBaseUrl: htmlSrv.baseUrl,
      projectId: 'kaizen-rules-test',
    });
    assert.equal(report.ok, false);
    assert.equal(report.auth.ok, false);
    assert.match(report.auth.reason || '', /Content-Type inválido/i);
    assert.equal(report.firestore.ok, false);
    assert.match(report.firestore.reason || '', /Content-Type inválido/i);
  } finally {
    await htmlSrv.close();
  }
});

test('7. Resposta JSON malformada com HTTP 200 e application/json deve ser rejeitada', async () => {
  const brokenJsonSrv = await startTempServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"authEmulator": {"ready": true'); // truncado
  });

  try {
    const report = await verifyEmulatorsHealth({
      authBaseUrl: brokenJsonSrv.baseUrl,
      firestoreBaseUrl: brokenJsonSrv.baseUrl,
      projectId: 'kaizen-rules-test',
    });
    assert.equal(report.ok, false);
    assert.equal(report.auth.ok, false);
    assert.match(report.auth.reason || '', /JSON inválido/i);
    assert.equal(report.firestore.ok, false);
    assert.match(report.firestore.reason || '', /JSON inválido/i);
  } finally {
    await brokenJsonSrv.close();
  }
});

test('8. Erro HTTP 404/500 mesmo com Content-Type application/json deve ser rejeitado', async () => {
  const errAuthSrv = await startTempServer((_req, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authEmulator: { ready: true } }));
  });
  const errFsSrv = await startTempServer((_req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rules: { files: [] } }));
  });

  try {
    const report = await verifyEmulatorsHealth({
      authBaseUrl: errAuthSrv.baseUrl,
      firestoreBaseUrl: errFsSrv.baseUrl,
      projectId: 'kaizen-rules-test',
    });
    assert.equal(report.ok, false);
    assert.equal(report.auth.ok, false);
    assert.match(report.auth.reason || '', /HTTP 404/);
    assert.equal(report.firestore.ok, false);
    assert.match(report.firestore.reason || '', /HTTP 500/);
  } finally {
    await Promise.all([errAuthSrv.close(), errFsSrv.close()]);
  }
});
