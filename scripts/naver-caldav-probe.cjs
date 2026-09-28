#!/usr/bin/env node
// Naver Calendar CalDAV probe — checks login, calendar discovery, event read, and (optionally) write.
// Usage: node scripts/naver-caldav-probe.cjs   (prompts for ID and password; nothing is stored)
//
// tsdav's createDAVClient discovery fails against Naver ("cannot find principalUrl") even though the
// server answers standard PROPFINDs, so discovery is done by hand and only tsdav's low-level calls are used.
const readline = require('readline');
const tsdav = require('tsdav');

const SERVER = 'https://caldav.calendar.naver.com';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const writeOutput = rl._writeToOutput.bind(rl);
let muted = false;
// Hide typed characters while entering the password
rl._writeToOutput = (s) => {
  if (!muted) writeOutput(s);
};

// Queue lines so input arriving before the next prompt (e.g. piped) is not lost
const lines = [];
const waiters = [];
rl.on('line', (line) => (waiters.length ? waiters.shift()(line) : lines.push(line)));
rl.on('close', () => waiters.splice(0).forEach((w) => w('')));

function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden;
  return new Promise((resolve) => {
    const done = (answer) => {
      if (hidden) process.stdout.write('\n');
      muted = false;
      resolve(answer.trim());
    };
    if (lines.length) done(lines.shift());
    else waiters.push(done);
  });
}

const pad = (n) => String(n).padStart(2, '0');
const icsUtc = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

async function rawPropfind(path, headers, depth, props) {
  const res = await fetch(new URL(path, SERVER).href, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: depth, 'Content-Type': 'application/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>${props}</d:prop>
</d:propfind>`,
  });
  return { status: res.status, text: await res.text() };
}

const hrefIn = (xml, tag) => new RegExp(`<[^>]*${tag}[^>]*>\\s*<[^>]*href>([^<]+)<`, 'i').exec(xml)?.[1];

async function main() {
  const username = await ask('Naver ID: ');
  const password = await ask('Password (app password if 2-step is on): ', { hidden: true });
  const headers = tsdav.getBasicAuthHeaders({ username, password });

  console.log('\n[1] Discovering principal / calendar home...');
  const root = await rawPropfind('/', headers, '0', '<d:current-user-principal/><c:calendar-home-set/>');
  if (root.status === 401) throw new Error('Invalid credentials (401)');
  const principalPath = hrefIn(root.text, 'current-user-principal');
  const homePath = hrefIn(root.text, 'calendar-home-set');
  console.log(`    status=${root.status} principal=${principalPath || '-'} home=${homePath || '-'}`);
  if (!principalPath || !homePath) throw new Error('principal or calendar-home-set missing');

  const account = {
    accountType: 'caldav',
    serverUrl: SERVER,
    rootUrl: `${SERVER}/`,
    principalUrl: new URL(principalPath, SERVER).href,
    homeUrl: new URL(homePath, SERVER).href,
  };

  console.log('\n    Listing calendars...');
  const calendars = await tsdav.fetchCalendars({ account, headers });
  console.log(`    OK - ${calendars.length} calendar(s)`);
  calendars.forEach((c, i) => {
    console.log(`    #${i} ${c.displayName || '(no name)'}  components=${(c.components || []).join(',') || '?'}`);
    console.log(`        ${c.url}`);
  });
  if (calendars.length === 0) {
    const home = await rawPropfind(homePath, headers, '1',
      '<d:resourcetype/><d:displayname/><c:supported-calendar-component-set/><cs:getctag/>');
    console.log(`\n[diag] PROPFIND ${homePath} (Depth 1) -> ${home.status}`);
    console.log('    ' + home.text.replace(/\s+/g, ' ').slice(0, 3000));
    return;
  }

  const idx = Number((await ask(`\nCalendar # to test [0]: `)) || 0);
  const cal = calendars[idx];
  if (!cal) throw new Error('Invalid calendar index');

  console.log(`\n[2] Reading events (last 30 days ~ next 60 days) from "${cal.displayName}"...`);
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 864e5).toISOString();
  const end = new Date(now.getTime() + 60 * 864e5).toISOString();
  const objects = await tsdav.fetchCalendarObjects({ calendar: cal, headers, timeRange: { start, end } });
  console.log(`    OK - ${objects.length} object(s)`);
  objects.slice(0, 3).forEach((o) => {
    const summary = /SUMMARY[^:]*:(.*)/.exec(o.data || '')?.[1]?.trim();
    const dtstart = /DTSTART[^:]*:(.*)/.exec(o.data || '')?.[1]?.trim();
    const hasRrule = /\nRRULE:/.test(o.data || '');
    console.log(`    - ${dtstart}  ${summary}${hasRrule ? '  (recurring)' : ''}  etag=${o.etag ? 'yes' : 'no'}`);
  });
  if (objects[0]) {
    console.log('\n    --- first object raw (first 25 lines) ---');
    console.log((objects[0].data || '').split(/\r?\n/).slice(0, 25).map((l) => '    ' + l).join('\n'));
  }

  const doWrite = (await ask('\n[3] Create + update + delete a test event "WTS CalDAV test" in 1 hour? (y/N): ')).toLowerCase() === 'y';
  if (!doWrite) return;

  const uid = `wts-probe-${Date.now()}@wts.local`;
  const s = new Date(now.getTime() + 3600e3);
  const e = new Date(s.getTime() + 1800e3);
  const ics = (title) => [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WTS//Planner Probe//KO', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${icsUtc(new Date())}`, `DTSTART:${icsUtc(s)}`, `DTEND:${icsUtc(e)}`,
    `SUMMARY:${title}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');

  const filename = `${uid.replace(/[^a-zA-Z0-9-]/g, '')}.ics`;
  const created = await tsdav.createCalendarObject({ calendar: cal, filename, iCalString: ics('WTS CalDAV test'), headers });
  console.log(`    create -> ${created.status} ${created.statusText} location=${created.headers.get('location') || '-'} etag=${created.headers.get('etag') || '-'}`);
  if (!created.ok) {
    console.log('    ' + (await created.text()).slice(0, 500));
    return;
  }

  const url = new URL(filename, cal.url).href;
  const [fetched] = await tsdav.fetchCalendarObjects({ calendar: cal, headers, objectUrls: [url] });
  console.log(`    re-fetch -> ${fetched ? 'found' : 'NOT found'} etag=${fetched?.etag || '-'}`);

  const updated = await tsdav.updateCalendarObject({
    calendarObject: { url, etag: fetched?.etag, data: ics('WTS CalDAV test (updated)') },
    headers,
  });
  console.log(`    update -> ${updated.status} ${updated.statusText}`);

  const [after] = await tsdav.fetchCalendarObjects({ calendar: cal, headers, objectUrls: [url] });
  const deleted = await tsdav.deleteCalendarObject({ calendarObject: { url, etag: after?.etag }, headers });
  console.log(`    delete -> ${deleted.status} ${deleted.statusText}`);
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
