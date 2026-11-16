import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidAdminUidConfig } from '../src/config/env';
import { evaluateSingleAdminAuthorization } from '../src/services/authService';

test('isValidAdminUidConfig rejeita vazio, placeholders e UIDs curtos/inválidos', () => {
  assert.equal(isValidAdminUidConfig(''), false);
  assert.equal(isValidAdminUidConfig('   '), false);
  assert.equal(isValidAdminUidConfig('REPLACE_WITH_YOUR_FIREBASE_UID'), false);
  assert.equal(isValidAdminUidConfig('undefined'), false);
  assert.equal(isValidAdminUidConfig('abc'), false);
  assert.equal(isValidAdminUidConfig('invalid uid with spaces'), false);
  assert.equal(isValidAdminUidConfig('FirebaseAdminUid123456'), true);
});

test('evaluateSingleAdminAuthorization nega acesso sem fallback quando AUTHORIZED_ADMIN_UID está ausente', () => {
  const emptyCfg = evaluateSingleAdminAuthorization({
    authenticatedUid: 'qualquer-uid-autenticado',
    authorizedUid: '',
  });
  assert.equal(emptyCfg.allowed, false);
  assert.equal(emptyCfg.configValid, false);
  assert.equal(emptyCfg.code, 'CONFIG_MISSING');

  const placeholderCfg = evaluateSingleAdminAuthorization({
    authenticatedUid: 'REPLACE_WITH_YOUR_FIREBASE_UID',
    authorizedUid: 'REPLACE_WITH_YOUR_FIREBASE_UID',
  });
  assert.equal(placeholderCfg.allowed, false);
  assert.equal(placeholderCfg.configValid, false);
  assert.equal(placeholderCfg.code, 'CONFIG_MISSING');
});

test('evaluateSingleAdminAuthorization nega acesso para usuário não autenticado ou UID diferente', () => {
  const unauth = evaluateSingleAdminAuthorization({
    authenticatedUid: null,
    authorizedUid: 'IanAdminUid123456',
  });
  assert.equal(unauth.allowed, false);
  assert.equal(unauth.configValid, true);
  assert.equal(unauth.code, 'UNAUTHENTICATED');

  const mismatch = evaluateSingleAdminAuthorization({
    authenticatedUid: 'OutroUidQualquer999',
    authorizedUid: 'IanAdminUid123456',
  });
  assert.equal(mismatch.allowed, false);
  assert.equal(mismatch.configValid, true);
  assert.equal(mismatch.code, 'UID_MISMATCH');
});

test('evaluateSingleAdminAuthorization autoriza somente quando configuração é válida e UID coincide exatamente', () => {
  const ok = evaluateSingleAdminAuthorization({
    authenticatedUid: 'IanAdminUid123456',
    authorizedUid: 'IanAdminUid123456',
  });
  assert.equal(ok.allowed, true);
  assert.equal(ok.configValid, true);
  assert.equal(ok.code, 'OK');
});
