// Pure iCalendar helpers for the Naver Calendar bridge (no Electron dependency, testable with node).
const crypto = require('crypto');
const ICAL = require('ical.js');

const MAX_OCCURRENCES = 1000;
const MAX_ITERATIONS = 50000;
let warn = () => {};
const setWarn = (fn) => { warn = fn; };

// ── iCalendar helpers ──

const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const hmOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex');

function registerTimezones(comp) {
  for (const tz of comp.getAllSubcomponents('vtimezone')) {
    try {
      const zone = new ICAL.Timezone(tz);
      if (!ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone);
    } catch (err) {
      warn('[Naver] Failed to register timezone', err?.message);
    }
  }
}

/** ICAL start/end → planner fields in local time. All-day DTEND is exclusive. */
function timeFields(start, end) {
  if (start.isDate) {
    const s = new Date(start.year, start.month - 1, start.day);
    let e = end ? new Date(end.year, end.month - 1, end.day - 1) : s;
    if (e < s) e = s;
    const date = ymdOf(s);
    const endDate = ymdOf(e);
    return { date, end_date: endDate !== date ? endDate : undefined };
  }
  const s = start.toJSDate();
  const e = end ? end.toJSDate() : s;
  const date = ymdOf(s);
  const endDate = ymdOf(e);
  return {
    date,
    start_time: hmOf(s),
    end_time: end ? hmOf(e) : undefined,
    end_date: endDate !== date ? endDate : undefined,
  };
}

/** One CalDAV object → planner events (recurring events expanded inside [rangeStart, rangeEnd)). */
function parseObject(obj, rangeStart, rangeEnd) {
  const comp = new ICAL.Component(ICAL.parse(obj.data));
  registerTimezones(comp);
  const vevents = comp.getAllSubcomponents('vevent');
  const master = vevents.find((v) => !v.hasProperty('recurrence-id')) || vevents[0];
  if (!master) return [];

  const hash = hashOf(obj.data);
  const exceptions = vevents.filter((v) => v !== master && v.hasProperty('recurrence-id'));
  const event = new ICAL.Event(master, { exceptions });
  const base = (item) => ({
    title: item.summary || '(제목 없음)',
    note: item.description || undefined,
  });

  if (!event.isRecurring()) {
    return [{
      external_id: obj.url,
      external_hash: hash,
      readonly: false,
      ...base(event),
      ...timeFields(event.startDate, event.endDate),
    }];
  }

  const out = [];
  const it = event.iterator();
  const durationMs = event.endDate ? event.endDate.toJSDate() - event.startDate.toJSDate() : 0;
  // Iterate from DTSTART (long-running series need many steps before the range), cap what is emitted
  for (let next = it.next(), n = 0; next && n < MAX_ITERATIONS && out.length < MAX_OCCURRENCES; next = it.next(), n++) {
    const startJs = next.toJSDate();
    if (startJs >= rangeEnd) break;
    if (startJs.getTime() + durationMs < rangeStart.getTime()) continue;
    const details = event.getOccurrenceDetails(next);
    const key = next.toICALString();
    out.push({
      external_id: `${obj.url}#${key}`,
      external_hash: hash,
      readonly: true,
      ...base(details.item),
      ...timeFields(details.startDate, details.endDate),
    });
  }
  return out;
}

function toIcalTimes(fields) {
  const y = Number(fields.date.slice(0, 4));
  const m = Number(fields.date.slice(4, 6));
  const d = Number(fields.date.slice(6, 8));
  const endYmd = fields.end_date || fields.date;
  const ey = Number(endYmd.slice(0, 4));
  const em = Number(endYmd.slice(4, 6));
  const ed = Number(endYmd.slice(6, 8));

  if (!fields.start_time) {
    const start = ICAL.Time.fromData({ year: y, month: m, day: d, isDate: true });
    const endJs = new Date(ey, em - 1, ed + 1); // exclusive
    const end = ICAL.Time.fromData({ year: endJs.getFullYear(), month: endJs.getMonth() + 1, day: endJs.getDate(), isDate: true });
    return { start, end };
  }
  const [sh, sm] = fields.start_time.split(':').map(Number);
  const startJs = new Date(y, m - 1, d, sh, sm);
  let endJs;
  if (fields.end_time) {
    const [eh, emin] = fields.end_time.split(':').map(Number);
    endJs = new Date(ey, em - 1, ed, eh, emin);
  }
  if (!endJs || endJs <= startJs) endJs = new Date(startJs.getTime() + 3600e3);
  return { start: ICAL.Time.fromJSDate(startJs, true), end: ICAL.Time.fromJSDate(endJs, true) };
}

function applyFields(vevent, fields) {
  const event = new ICAL.Event(vevent);
  event.summary = fields.title;
  if (fields.note) event.description = fields.note;
  else vevent.removeAllProperties('description');
  const { start, end } = toIcalTimes(fields);
  vevent.removeAllProperties('duration');
  event.startDate = start;
  event.endDate = end;
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true));
  vevent.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(new Date(), true));
}

function newIcs(uid, fields) {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('prodid', '-//WTS//Planner//KO');
  cal.updatePropertyWithValue('version', '2.0');
  const vevent = new ICAL.Component('vevent');
  vevent.updatePropertyWithValue('uid', uid);
  applyFields(vevent, fields);
  cal.addSubcomponent(vevent);
  return cal.toString();
}

module.exports = { parseObject, newIcs, applyFields, hashOf, setWarn, ICAL };
