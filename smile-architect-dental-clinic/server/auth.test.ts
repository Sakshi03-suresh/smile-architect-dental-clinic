import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import {
  getAdminFromRequest,
  hashPassword,
  isHttpsRequest,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './auth.ts';

test('hashPassword and verifyPassword validate default admin password securely', () => {
  const hash = hashPassword('SmileAdmin@2026');
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword('SmileAdmin@2026', hash), true);
  assert.equal(verifyPassword('WrongPassword!', hash), false);
});

test('signSessionToken and verifySessionToken round-trip payload', () => {
  const token = signSessionToken({
    userId: 1,
    email: 'admin@smilearchitect.in',
    name: 'Clinic Administrator',
    role: 'admin',
  });
  const parsed = verifySessionToken(token);
  assert.ok(parsed);
  assert.equal(parsed.email, 'admin@smilearchitect.in');
  assert.equal(parsed.role, 'admin');
  assert.equal(verifySessionToken(`${token}tampered`), null);
});

test('getAdminFromRequest accepts Authorization Bearer token and session cookie', () => {
  const token = signSessionToken({
    userId: 1,
    email: 'admin@smilearchitect.in',
    name: 'Clinic Administrator',
    role: 'admin',
  });

  const bearerReq = {
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  } as unknown as Request;
  assert.equal(getAdminFromRequest(bearerReq)?.email, 'admin@smilearchitect.in');

  const cookieReq = {
    headers: {},
    cookies: { sadc_admin_session: token },
  } as unknown as Request;
  assert.equal(getAdminFromRequest(cookieReq)?.email, 'admin@smilearchitect.in');

  const emptyReq = {
    headers: {},
    cookies: {},
  } as unknown as Request;
  assert.equal(getAdminFromRequest(emptyReq), null);
});

test('isHttpsRequest detects x-forwarded-proto https behind Cloud Run proxy', () => {
  const httpsReq = {
    secure: false,
    get: (name: string) => (name.toLowerCase() === 'x-forwarded-proto' ? 'https, http' : ''),
  } as unknown as Request;
  assert.equal(isHttpsRequest(httpsReq), true);

  const localReq = {
    secure: false,
    get: () => '',
  } as unknown as Request;
  assert.equal(isHttpsRequest(localReq), false);
});
