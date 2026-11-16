import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createApiRouter } from '../src/api/routes';

async function startTestServer(options: {
  rateLimitMaxRequests?: number;
  authorizedUid?: string;
} = {}) {
  const prevAllowedUid = process.env.AUTHORIZED_ADMIN_UID;
  if (options.authorizedUid !== undefined) {
    process.env.AUTHORIZED_ADMIN_UID = options.authorizedUid;
  } else {
    delete process.env.AUTHORIZED_ADMIN_UID;
  }

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(
    createApiRouter({
      rateLimitMaxRequests: options.rateLimitMaxRequests ?? 30,
      rateLimitWindowMs: 60_000,
      verifyToken: async (token: string) => {
        if (token === 'valid-admin-token') {
          return { uid: 'uid-admin-1', email: 'admin@example.com' };
        }
        if (token === 'other-user-token') {
          return { uid: 'uid-other-999', email: 'other@example.com' };
        }
        throw new Error('INVALID_TOKEN');
      },
    })
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: async () => {
      if (prevAllowedUid !== undefined) {
        process.env.AUTHORIZED_ADMIN_UID = prevAllowedUid;
      } else {
        delete process.env.AUTHORIZED_ADMIN_UID;
      }
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    },
  };
}

test('GET /api/health responde 200 sem expor segredos', async () => {
  const srv = await startTestServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, 'ok');
  } finally {
    await srv.close();
  }
});

test('Rotas /api/gemini/* rejeitam requisições sem token ou com token inválido (401)', async () => {
  const srv = await startTestServer();
  try {
    const endpoints = [
      '/api/gemini/generate-pitch',
      '/api/gemini/improve-script',
      '/api/gemini/analyze-leads',
      '/api/gemini/filter-imported-leads',
    ];

    for (const ep of endpoints) {
      const noAuth = await fetch(`${srv.baseUrl}${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(noAuth.status, 401, `${ep} sem auth deve retornar 401`);

      const badAuth = await fetch(`${srv.baseUrl}${ep}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({}),
      });
      assert.equal(badAuth.status, 401, `${ep} com token inválido deve retornar 401`);
    }
  } finally {
    await srv.close();
  }
});

test('Rotas /api/gemini/* bloqueiam UID diferente do administrador único (403)', async () => {
  const srv = await startTestServer({ authorizedUid: 'uid-admin-1' });
  try {
    const denied = await fetch(`${srv.baseUrl}/api/gemini/generate-pitch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer other-user-token',
      },
      body: JSON.stringify({ companyName: 'Teste' }),
    });
    assert.equal(denied.status, 403);
  } finally {
    await srv.close();
  }
});

test('Rotas /api/gemini/* validam parâmetros e aplicam rate limiting (400 e 429)', async () => {
  const srv = await startTestServer({
    authorizedUid: 'uid-admin-1',
    rateLimitMaxRequests: 2,
  });
  try {
    const missingField = await fetch(`${srv.baseUrl}/api/gemini/generate-pitch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-admin-token',
      },
      body: JSON.stringify({}),
    });
    assert.equal(missingField.status, 400);

    const oversizedFilter = await fetch(`${srv.baseUrl}/api/gemini/filter-imported-leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-admin-token',
      },
      body: JSON.stringify({
        userInstruction: 'filtrar',
        leads: new Array(501).fill({ id: 'x', companyName: 'Y' }),
      }),
    });
    assert.equal(oversizedFilter.status, 400);

    const rateLimited = await fetch(`${srv.baseUrl}/api/gemini/generate-pitch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-admin-token',
      },
      body: JSON.stringify({ companyName: 'Empresa' }),
    });
    assert.equal(rateLimited.status, 429);
  } finally {
    await srv.close();
  }
});
