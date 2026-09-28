// Naver Calendar (CalDAV) bridge for the personal planner.
// Runs in the main process: the renderer cannot reach caldav.calendar.naver.com because of CORS,
// and the password must stay encrypted (safeStorage) outside the renderer's localStorage.
//
// tsdav's automatic discovery fails against Naver ("cannot find principalUrl"), so the principal and
// calendar home are discovered with a raw PROPFIND and only tsdav's fetchCalendars /
// fetchCalendarObjects are used. PUT / GET / DELETE of single objects are plain fetch calls.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log/main');
const tsdav = require('tsdav');
const { parseObject, newIcs, applyFields, hashOf, setWarn, ICAL } = require('./naverIcs.cjs');

setWarn((...args) => log.warn(...args));

const SERVER = 'https://caldav.calendar.naver.com';

const configPath = () => path.join(app.getPath('userData'), 'naver-calendar.json');

// ── Config ──

function readConfig() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
  } catch {
    return null;
  }
  // v0.6 stored one calendar as calendarUrl/calendarName
  if (!Array.isArray(config.calendars)) {
    config.calendars = config.calendarUrl ? [{ url: config.calendarUrl, name: config.calendarName || '', color: null }] : [];
  }
  delete config.calendarUrl;
  delete config.calendarName;
  return config;
}

function writeConfig(config) {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function getCredentials() {
  const config = readConfig();
  if (!config?.username || !config?.password) throw new Error('네이버 캘린더가 연결되어 있지 않습니다.');
  const password = safeStorage.decryptString(Buffer.from(config.password, 'base64'));
  return { config, username: config.username, password };
}

const authHeaders = (username, password) => tsdav.getBasicAuthHeaders({ username, password });

// ── Discovery ──

const hrefIn = (xml, tag) => new RegExp(`<[^>]*${tag}[^>]*>\\s*<[^>]*href>([^<]+)<`, 'i').exec(xml)?.[1];

async function discover(headers) {
  const res = await fetch(`${SERVER}/`, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:current-user-principal/><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });
  if (res.status === 401) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다. 2단계 인증을 쓰면 애플리케이션 비밀번호를 입력하세요.');
  if (!res.ok) throw new Error(`네이버 캘린더 서버 응답 오류 (${res.status})`);
  const xml = await res.text();
  const principal = hrefIn(xml, 'current-user-principal');
  const home = hrefIn(xml, 'calendar-home-set');
  if (!principal || !home) throw new Error('네이버 캘린더 경로를 찾을 수 없습니다.');
  return {
    accountType: 'caldav',
    serverUrl: SERVER,
    rootUrl: `${SERVER}/`,
    principalUrl: new URL(principal, SERVER).href,
    homeUrl: new URL(home, SERVER).href,
  };
}

/** Apple calendar-color comes as "#RRGGBB" or "#RRGGBBAA" (sometimes wrapped in an object) */
function normalizeColor(value) {
  const raw = typeof value === 'string' ? value : value?._text ?? value?._cdata ?? null;
  const m = typeof raw === 'string' && /#[0-9a-f]{6}/i.exec(raw);
  return m ? m[0].toLowerCase() : null;
}

const withSlash = (url) => (url.endsWith('/') ? url : `${url}/`);

function requireCalendar(config, calendarUrl) {
  const cal = config.calendars.find((c) => c.url === calendarUrl);
  if (!cal) throw new Error('동기화하도록 선택한 캘린더가 아닙니다.');
  return cal;
}

async function listCalendarsWith(username, password) {
  const headers = authHeaders(username, password);
  const account = await discover(headers);
  const calendars = await tsdav.fetchCalendars({ account, headers });
  return calendars
    .filter((c) => !c.components?.length || c.components.includes('VEVENT'))
    .map((c) => ({ url: c.url, name: String(c.displayName || '(이름 없음)'), color: normalizeColor(c.calendarColor) }));
}

// ── Object I/O ──

async function getObject(url, headers) {
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`일정 조회 실패 (${res.status})`);
  return await res.text();
}

async function putObject(url, headers, ics, { create }) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'text/calendar; charset=utf-8',
      ...(create ? { 'If-None-Match': '*' } : {}),
    },
    body: ics,
  });
  if (!res.ok) throw new Error(`일정 저장 실패 (${res.status})`);
}

// ── Public API (IPC) ──

async function status() {
  const config = readConfig();
  return {
    available: safeStorage.isEncryptionAvailable(),
    connected: !!(config?.username && config?.password && config?.calendars.length),
    username: config?.username || null,
    calendars: config?.calendars || [],
    empUid: config?.empUid ?? null,
  };
}

/** Verify credentials, store them encrypted, and return selectable calendars. */
async function connect({ username, password }) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('이 PC에서는 비밀번호 암호화를 사용할 수 없습니다.');
  const calendars = await listCalendarsWith(username, password);
  const prev = readConfig();
  writeConfig({
    username,
    password: safeStorage.encryptString(password).toString('base64'),
    calendars: prev?.username === username ? prev.calendars : [],
    empUid: prev?.empUid ?? null,
  });
  log.info(`[Naver] Connected as ${username} (${calendars.length} calendars)`);
  return calendars;
}

async function listCalendars() {
  const { username, password } = getCredentials();
  return listCalendarsWith(username, password);
}

async function selectCalendars({ calendars, empUid }) {
  const config = readConfig();
  if (!config) throw new Error('네이버 캘린더가 연결되어 있지 않습니다.');
  writeConfig({ ...config, calendars, empUid });
  log.info(`[Naver] Calendars selected: ${calendars.map((c) => c.name).join(', ')}`);
}

async function disconnect() {
  try {
    fs.unlinkSync(configPath());
  } catch { /* already gone */ }
  log.info('[Naver] Disconnected');
}

async function fetchEvents({ start, end }) {
  const { config, username, password } = getCredentials();
  if (!config.calendars.length) throw new Error('동기화할 캘린더를 선택하세요.');
  const headers = authHeaders(username, password);
  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);
  const events = [];
  // Fail the whole fetch if any calendar fails, so the renderer never mistakes a missing calendar for deletions
  for (const cal of config.calendars) {
    const objects = await tsdav.fetchCalendarObjects({ calendar: { url: cal.url }, headers, timeRange: { start, end } });
    let count = 0;
    for (const obj of objects) {
      if (!obj.data || !/BEGIN:VEVENT/i.test(obj.data)) continue;
      try {
        const parsed = parseObject(obj, rangeStart, rangeEnd).map((e) => ({ ...e, calendar_url: cal.url }));
        events.push(...parsed);
        count += parsed.length;
      } catch (err) {
        log.warn(`[Naver] Skipping unparsable object ${obj.url}:`, err?.message);
      }
    }
    log.info(`[Naver] Fetched ${cal.name}: ${objects.length} objects -> ${count} events`);
  }
  return events;
}

async function createEvent({ fields, calendarUrl }) {
  const { config, username, password } = getCredentials();
  const cal = requireCalendar(config, calendarUrl);
  const headers = authHeaders(username, password);
  const uid = `wts-${crypto.randomUUID()}`;
  const url = new URL(`${uid}.ics`, withSlash(cal.url)).href;
  await putObject(url, headers, newIcs(uid, fields), { create: true });
  const stored = await getObject(url, headers);
  log.info(`[Naver] Created ${url}`);
  return { external_id: url, external_hash: stored ? hashOf(stored) : null };
}

/** Update title/time/note on the server copy so other properties (alarms, location...) survive. */
async function updateEvent({ href, fields }) {
  const { username, password } = getCredentials();
  const headers = authHeaders(username, password);
  const current = await getObject(href, headers);
  if (current === null) return { deleted: true };
  const comp = new ICAL.Component(ICAL.parse(current));
  const vevents = comp.getAllSubcomponents('vevent');
  const master = vevents.find((v) => !v.hasProperty('recurrence-id')) || vevents[0];
  if (!master) throw new Error('일정 형식을 해석할 수 없습니다.');
  applyFields(master, fields);
  const seq = Number(master.getFirstPropertyValue('sequence') || 0);
  master.updatePropertyWithValue('sequence', seq + 1);
  await putObject(href, headers, comp.toString(), { create: false });
  log.info(`[Naver] Updated ${href}`);
  const stored = await getObject(href, headers);
  return { deleted: false, external_hash: stored ? hashOf(stored) : null };
}

async function deleteEvent({ href }) {
  const { username, password } = getCredentials();
  const res = await fetch(href, { method: 'DELETE', headers: authHeaders(username, password) });
  if (!res.ok && res.status !== 404) throw new Error(`일정 삭제 실패 (${res.status})`);
  log.info(`[Naver] Deleted ${href} (${res.status})`);
}

function registerNaverIpc(ipcMain) {
  const handlers = { status, connect, listCalendars, selectCalendars, disconnect, fetchEvents, createEvent, updateEvent, deleteEvent };
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(`naver:${name}`, async (_e, arg) => {
      try {
        return { ok: true, data: await fn(arg) };
      } catch (err) {
        log.error(`[Naver] ${name} failed:`, err?.message || err);
        return { ok: false, error: err?.message || String(err) };
      }
    });
  }
}

module.exports = { registerNaverIpc };
