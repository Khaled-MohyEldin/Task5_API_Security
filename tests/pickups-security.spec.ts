// spec: API Security Tests - Pickups
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({
  baseURL: 'https://stg-app.bosta.co',
  extraHTTPHeaders: {
    'content-type': 'application/json',
    'Authorization': 'bca27763f5f30353ba0ee3d2ebd8951994f5016e269bbd781798e2884274d631'
  },
});

const LAST_DATE_PATH = path.resolve(process.cwd(), 'test-data', 'lastPickupDate.txt');

function parseDateYMD(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function formatDateYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number) {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Read last saved date and return `count` sequential dates starting from the next day.
function reserveDates(count: number) {
  let startDate: Date | undefined;
  try {
    if (fs.existsSync(LAST_DATE_PATH)) {
      const txt = fs.readFileSync(LAST_DATE_PATH, 'utf8').trim();
      if (txt) {
        startDate = parseDateYMD(txt);
      }
    }
  } catch (e) {
    // ignore read errors and fall back
  }
  // default start if none found: 2026-01-01
  if (!startDate) startDate = parseDateYMD('2026-01-01');

  // We want to start from the next day after the last saved date
  let current = addDays(startDate, 1);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(formatDateYMD(current));
    current = addDays(current, 1);
  }

  // Persist the last used date so next run begins after it
  try {
    const lastUsed = dates[dates.length - 1];
    const dir = path.dirname(LAST_DATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LAST_DATE_PATH, lastUsed, 'utf8');
  } catch (e) {
    // If we can't persist, tests still run but the user will be notified
    console.warn('Could not persist lastPickupDate:', e);
  }

  return dates;
}

const basePickup = {
  businessLocationId: 'MFqXsoFhxO',
  contactPerson: {
    _id: '_sCFBrHGi',
    name: 'testname',
    email: 'amira.mosa+991^@bosta.co',
    phone: '+201055592829'
  },
  numberOfParcels: '3',
  hasBigItems: false,
  repeatedData: { repeatedType: 'One Time' },
  creationSrc: 'Web'
};

// Define the counts for each test so we know how many unique dates to reserve
const injectStrings = ["' OR '1'='1", "<script>alert('x')</script>", '); DROP TABLE users; --'];
const oversizedCases = ['-1', '999999999999', 'not-a-number'];
const malformed = [
  { phone: 'abcdef', email: 'no-at-symbol' },
  { phone: '', email: 'a@b' }
];
const rapidCount = 5;
const TOTAL_DATES_NEEDED = 1 /* control */ + 1 /* missing auth */ + injectStrings.length + oversizedCases.length + malformed.length + 1 /* tamper */ + rapidCount;

test.describe('Pickups: security and robustness checks', () => {
  // Reserve the dates once at the start for clear reporting and deterministic assignment
  const dates = reserveDates(TOTAL_DATES_NEEDED);
  let dateIndex = 0;

  test('Control — create a valid pickup', async ({ request }) => {
    // Step: send a well-formed payload and expect success (or controlled validation)
    const payload = { ...basePickup, scheduledDate: dates[dateIndex++] };
    const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000 });
    const text = await res.text();
    expect(res.status()).toBeLessThan(500);
    // Prefer 200 but accept controlled validation; ensure body exists on success
    if (res.status() === 200) expect(text).toBeTruthy();
  });

  test('Missing Authorization — should reject (4xx) and not cause 5xx', async ({ request }) => {
    const payload = { ...basePickup, scheduledDate: dates[dateIndex++] };
    const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000, 
      headers: { 'content-type': 'application/json', 'Authorization': '' } });
    console.log(await res.json());
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).not.toBe(200);
  });

  test.describe('Injection attempts in contact person fields', () => {
    for (let i = 0; i < injectStrings.length; i++) {
      const s = injectStrings[i];
      test(`Injection payload #${i + 1} — ${s}`, async ({ request }) => {
        const payload = {
          ...basePickup,
          scheduledDate: dates[dateIndex++],
          contactPerson: { ...basePickup.contactPerson, name: `attacker ${s}`, email: `attacker${i}+probe@example.com` }
        };
        const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000 });
        const text = await res.text();
        expect(res.status()).toBeLessThan(500);
        expect(text.toLowerCase()).not.toContain('stack');
        expect(text.toLowerCase()).not.toContain('trace');
      });
    }
  });

  test.describe('Validation edge-cases for numberOfParcels', () => {
    for (let i = 0; i < oversizedCases.length; i++) {
      const val = oversizedCases[i];
      test(`numberOfParcels = ${val}`, async ({ request }) => {
        const payload = { ...basePickup, scheduledDate: dates[dateIndex++], numberOfParcels: val };
        const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000 });
        expect(res.status()).toBeLessThan(500);
        expect(res.status()).not.toBe(200);
      });
    }
  });

  test.describe('Malformed contact details', () => {
    for (let i = 0; i < malformed.length; i++) {
      const m = malformed[i];
      test(`malformed contact #${i + 1}`, async ({ request }) => {
        const payload = { ...basePickup, scheduledDate: dates[dateIndex++], contactPerson: { ...basePickup.contactPerson, phone: m.phone, email: m.email } };
        const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000 });
        const text = await res.text();
        expect(res.status()).toBeLessThan(500);
        expect(res.status()).not.toBe(200);
        expect(text.toLowerCase()).not.toContain('stack');
      });
    }
  });

  test('Tampered businessLocationId — expect rejection (4xx) and not 5xx', async ({ request }) => {
    const payload = { ...basePickup, scheduledDate: dates[dateIndex++], businessLocationId: 'NOT-OWNED-ID-999' };
    const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000 });
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).not.toBe(200);
  });

  test('Rate-limit probe — rapid repeated valid requests', async ({ request }) => {
    for (let i = 0; i < rapidCount; i++) {
      const payload = { ...basePickup, scheduledDate: dates[dateIndex++] };
      const res = await request.post('/api/v2/pickups', { data: payload, timeout: 7000 });
      expect(res.status()).toBeLessThan(500);
    }
  });

});
