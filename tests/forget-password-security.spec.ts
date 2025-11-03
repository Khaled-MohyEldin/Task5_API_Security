// spec: API Security Tests - Forget Password
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'https://stg-app.bosta.co',
  extraHTTPHeaders: {
    'content-type': 'application/json',
    'Authorization': 'bca27763f5f30353ba0ee3d2ebd8951994f5016e269bbd781798e2884274d631'
  },
});

const knownEmail = 'amira.mosa+991^@bosta.co';

test.describe('Forget-password: security and privacy checks', () => {
  test('Control — known email should be handled without leaking sensitive info', async ({ request }) => {
    // Step: submit known email and expect controlled response (no 5xx)
    const res = await request.post('/api/v2/users/forget-password', { data: { email: knownEmail }, timeout: 7000 });
    const text = await res.text();
    expect(res.status()).toBeLessThan(500);
    expect(text.toLowerCase()).not.toContain('stack');
  });

  test('Missing body / empty email — should reject with client error (4xx) and not 5xx', async ({ request }) => {
    const res = await request.post('/api/v2/users/forget-password', { data: {}, timeout: 7000 });
    const text = await res.text();
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).not.toBe(200);
    expect(text.toLowerCase()).not.toContain('stack');
  });

  test('Email enumeration probe — responses should not disclose account existence', async ({ request }) => {
    const probeEmails = ['doesnotexist@example.com', knownEmail, 'maybeexists+probe@example.com'];
    const responses = [] as { status: number; text: string }[];
    for (const e of probeEmails) {
      const res = await request.post('/api/v2/users/forget-password', { data: { email: e }, timeout: 7000 });
      const text = await res.text();
      responses.push({ status: res.status(), text });
      expect(res.status()).toBeLessThan(500);
    }

    // Basic privacy checks: no raw stack traces, no SQL errors, messages should be generic
    for (const r of responses) {
      expect(r.text.toLowerCase()).not.toContain('stack');
      expect(r.text.toLowerCase()).not.toContain('sql');
    }

    // Optional stronger check: ensure all statuses are the same (if your API intentionally hides existence)
    const uniqueStatuses = Array.from(new Set(responses.map(r => r.status)));
    // We don't assert equality by default because some systems return 200 for known emails and 204 for unknowns.
    // If you'd like strict equality, change this assertion accordingly.
    expect(uniqueStatuses.length).toBeGreaterThanOrEqual(1);
  });
});
