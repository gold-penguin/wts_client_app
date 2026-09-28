import { useEffect, useSyncExternalStore } from 'react';
import { naverApi, naverAvailable, type EventFields, type NaverCalendar, type NaverStatus, type RemoteEvent } from '../api/naverCalendar';
import {
  CHANGE_EVENT, loadItems, replaceItems, loadDeleted, clearDeleted, isDirty, newId, toYmd,
} from './plannerStore';
import type { PlannerItem } from '../types/planner';

// 네이버 캘린더 ↔ 로컬 일정 동기화. 메인 창에서만 실행한다(위젯의 변경은 storage 이벤트로 감지).
// 동기화 대상은 설정에서 고른 여러 캘린더이고, 일정마다 올릴 캘린더(calendar_url)를 고를 수 있다.
// 순서: ① 로컬에서 지운 일정 원격 삭제 → ② 로컬 변경 업로드(캘린더를 바꿨으면 옮김) → ③ 원격 일정 내려받아 반영.
// 같은 일정을 양쪽에서 고쳤다면 ②가 먼저 올리므로 로컬 수정이 이긴다.
// 할 일(todo)은 동기화하지 않는다.

const RANGE_BACK_DAYS = 60;
const RANGE_AHEAD_DAYS = 365;
const AUTO_SYNC_MS = 10 * 60 * 1000;
const CHANGE_DEBOUNCE_MS = 3000;
const LAST_SYNC_KEY = 'wts_naver_last_sync';

// ── 상태 (UI 표시용) ──

export interface NaverSyncState {
  status: NaverStatus | null;
  running: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

let state: NaverSyncState = {
  status: null,
  running: false,
  lastSyncedAt: localStorage.getItem(LAST_SYNC_KEY),
  lastError: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<NaverSyncState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export function useNaverSyncState(): NaverSyncState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
  );
}

export async function refreshNaverStatus(): Promise<NaverStatus | null> {
  if (!naverAvailable()) return null;
  try {
    const status = await naverApi.status();
    setState({ status });
    return status;
  } catch (err) {
    setState({ lastError: (err as Error).message });
    return null;
  }
}

// ── 동기화 ──

const fieldsOf = (i: PlannerItem): EventFields => ({
  title: i.title,
  note: i.note,
  date: i.date,
  end_date: i.end_date,
  start_time: i.start_time,
  end_time: i.end_time,
});

/** 원격 값으로 덮어쓸 필드. 원격에 없는 값은 undefined로 명시해 로컬의 옛 값을 지운다. */
const remoteFields = (r: RemoteEvent) => ({
  title: r.title,
  note: r.note,
  date: r.date,
  end_date: r.end_date,
  start_time: r.start_time,
  end_time: r.end_time,
  external_id: r.external_id,
  external_hash: r.external_hash,
  calendar_url: r.calendar_url,
  readonly: r.readonly || undefined,
});

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

// 네이버 색이 없는 캘린더에 순서대로 쓰는 색
const CALENDAR_PALETTE = ['#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed', '#0891b2', '#dc2626'];

/** 캘린더 표시 색: 네이버 색 → 없으면 선택 순서대로 팔레트 */
export function calendarColor(calendars: NaverCalendar[], calendarUrl?: string): string | undefined {
  const idx = calendars.findIndex(c => c.url === calendarUrl);
  if (idx < 0) return undefined;
  return calendars[idx].color ?? CALENDAR_PALETTE[idx % CALENDAR_PALETTE.length];
}

/** 원격 일정 URL이 속한 (선택된) 캘린더 */
export const calendarOf = (calendars: NaverCalendar[], externalId?: string) =>
  externalId ? calendars.find(c => externalId.startsWith(withSlash(c.url))) : undefined;

/** 업로드 결과 반영. 업로드 도중 사용자가 또 고쳤다면(rev가 바뀜) synced_rev를 올리지 않아 다음 동기화 때 다시 올라간다. */
function markPushed(empUid: number, id: string, sentRev: number, meta: Partial<PlannerItem>) {
  replaceItems(empUid, loadItems(empUid).map(i => {
    if (i.id !== id) return i;
    return (i.rev ?? 0) === sentRev ? { ...i, ...meta, synced_rev: sentRev } : { ...i, ...meta };
  }));
}

/** 할 일로 바뀌었거나 '네이버에 올리지 않음'으로 바뀐 동기화 일정 → 원격에서는 지우고 로컬 연결 정보 제거 */
function unlink(empUid: number, id: string) {
  replaceItems(empUid, loadItems(empUid).map(i =>
    i.id === id ? { ...i, external_id: undefined, external_hash: undefined, synced_rev: undefined, readonly: undefined } : i,
  ));
}

const shouldUnlink = (i: PlannerItem) => !!i.external_id && (i.kind === 'todo' || !!i.local_only);

const needsPush = (i: PlannerItem) =>
  (i.kind === 'event' && !i.readonly && !i.local_only && !!i.date && isDirty(i)) || shouldUnlink(i);

// 새 일정을 올릴 캘린더 기본값 — 마지막 선택을 기억 ('' = 올리지 않음). 이 PC 편의 설정.
const UPLOAD_TARGET_KEY = 'wts_naver_upload_target';
const LEGACY_UPLOAD_DEFAULT_KEY = 'wts_naver_upload_default';

export function getUploadTarget(calendars: NaverCalendar[]): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(UPLOAD_TARGET_KEY);
    if (stored === null && localStorage.getItem(LEGACY_UPLOAD_DEFAULT_KEY) === 'false') stored = '';
  } catch { /* 기본값 사용 */ }
  if (stored === '') return '';
  if (stored && calendars.some(c => c.url === stored)) return stored;
  return calendars[0]?.url ?? '';
}

export function setUploadTarget(calendarUrl: string) {
  try { localStorage.setItem(UPLOAD_TARGET_KEY, calendarUrl); } catch { /* 편의 설정일 뿐 */ }
}

/** 일정 폼에서 보여 줄 현재 선택: 올리지 않음('') 또는 캘린더 URL */
export function uploadTargetOf(item: PlannerItem, calendars: NaverCalendar[]): string {
  if (item.local_only) return '';
  return item.calendar_url ?? calendarOf(calendars, item.external_id)?.url ?? getUploadTarget(calendars);
}

/** 이 사용자에게 네이버 동기화가 켜져 있는지 (체크박스 표시 여부) */
export const isNaverLinked = (s: NaverSyncState, empUid: number) => !!s.status?.connected && s.status.empUid === empUid;

export function hasPendingChanges(empUid: number) {
  return loadDeleted(empUid).length > 0 || loadItems(empUid).some(needsPush);
}

async function push(empUid: number, calendars: NaverCalendar[]) {
  const deleted = loadDeleted(empUid);
  for (const href of deleted) await naverApi.deleteEvent(href);
  if (deleted.length) clearDeleted(empUid, deleted);

  const fallback = getUploadTarget(calendars) || calendars[0].url;
  for (const item of loadItems(empUid).filter(needsPush)) {
    if (shouldUnlink(item)) {
      if (!item.readonly) await naverApi.deleteEvent(item.external_id!);
      unlink(empUid, item.id);
      continue;
    }
    const fields = fieldsOf(item);
    const current = calendarOf(calendars, item.external_id)?.url;
    const target = item.calendar_url && calendars.some(c => c.url === item.calendar_url)
      ? item.calendar_url
      : current ?? fallback;

    if (item.external_id && current && current !== target) {
      // 다른 캘린더로 옮김: 새 캘린더에 만들고 원래 것은 지운다
      const res = await naverApi.createEvent(fields, target);
      await naverApi.deleteEvent(item.external_id);
      markPushed(empUid, item.id, item.rev ?? 0, { external_id: res.external_id, external_hash: res.external_hash ?? undefined, calendar_url: target });
      continue;
    }
    if (item.external_id) {
      const res = await naverApi.updateEvent(item.external_id, fields);
      if (!res.deleted) {
        markPushed(empUid, item.id, item.rev ?? 0, { external_hash: res.external_hash ?? undefined, calendar_url: current ?? target });
        continue;
      }
      // 원격에서 지워진 일정을 로컬에서 고쳤다면 새로 만든다
    }
    const res = await naverApi.createEvent(fields, target);
    markPushed(empUid, item.id, item.rev ?? 0, { external_id: res.external_id, external_hash: res.external_hash ?? undefined, calendar_url: target });
  }
}

async function pull(empUid: number, calendars: NaverCalendar[]) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - RANGE_BACK_DAYS);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + RANGE_AHEAD_DAYS);
  const startYmd = toYmd(start);
  const endYmd = toYmd(end);

  const remote = await naverApi.fetchEvents(start, end);
  const remoteById = new Map(remote.map(r => [r.external_id, r]));
  const now = new Date().toISOString();

  // fetch 이후 await 없이 한 번에 반영 — 그 사이 사용자 수정이 끼어들지 않음
  const items = loadItems(empUid);
  const seen = new Set<string>();
  const next: PlannerItem[] = [];
  for (const item of items) {
    if (item.kind !== 'event' || !item.external_id) {
      next.push(item);
      continue;
    }
    seen.add(item.external_id);
    const r = remoteById.get(item.external_id);
    if (!r) {
      // 조회 범위 안인데 원격에 없으면 네이버에서 삭제된 것(또는 동기화 대상에서 뺀 캘린더).
      // 로컬에서 고치는 중이면 남겨 두고 다음에 다시 올린다.
      const inRange = !!item.date && item.date >= startYmd && item.date < endYmd;
      const calendarDropped = !calendarOf(calendars, item.external_id);
      if ((inRange || calendarDropped) && !isDirty(item)) continue;
      next.push(item);
      continue;
    }
    if (isDirty(item) || r.external_hash === item.external_hash) {
      next.push(item);
      continue;
    }
    const rev = (item.rev ?? 0) + 1;
    next.push({ ...item, ...remoteFields(r), updated_at: now, rev, synced_rev: rev });
  }
  for (const r of remote) {
    if (seen.has(r.external_id)) continue;
    next.push({ id: newId(), kind: 'event', ...remoteFields(r), created_at: now, updated_at: now, rev: 1, synced_rev: 1 });
  }
  replaceItems(empUid, next);
}

/** 동기화 대상에서 뺀 캘린더의 일정을 앱에서만 지운다 (네이버에는 그대로 남음) */
export function detachCalendarItems(empUid: number, calendarUrls: string[]) {
  if (!calendarUrls.length) return;
  const prefixes = calendarUrls.map(withSlash);
  const inRemoved = (href?: string) => !!href && prefixes.some(p => href.startsWith(p));
  clearDeleted(empUid, loadDeleted(empUid).filter(inRemoved));
  replaceItems(empUid, loadItems(empUid)
    .filter(i => !inRemoved(i.external_id))
    .map(i => (i.calendar_url && calendarUrls.includes(i.calendar_url) ? { ...i, calendar_url: undefined } : i)));
}

/** 연결 해제·사용자 변경 시: 네이버와 연결된 일정을 앱에서만 지운다 (네이버에는 그대로 남음) */
export function detachNaverItems(empUid: number) {
  clearDeleted(empUid, loadDeleted(empUid));
  replaceItems(empUid, loadItems(empUid).filter(i => !i.external_id));
  localStorage.removeItem(LAST_SYNC_KEY);
  setState({ lastSyncedAt: null, lastError: null });
}

async function runSync(empUid: number) {
  const status = await refreshNaverStatus();
  if (!status?.connected || status.empUid !== empUid) return;
  setState({ running: true, lastError: null });
  try {
    await push(empUid, status.calendars);
    await pull(empUid, status.calendars);
    const at = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, at);
    setState({ lastSyncedAt: at });
  } catch (err) {
    setState({ lastError: (err as Error).message });
    throw err;
  } finally {
    setState({ running: false });
  }
}

let inflight: Promise<void> | null = null;

export function syncNaver(empUid: number): Promise<void> {
  if (!inflight) inflight = runSync(empUid).finally(() => { inflight = null; });
  return inflight;
}

/** 메인 창에서 호출: 시작 시·10분마다·로컬 변경 3초 후 동기화 */
export function useNaverAutoSync(empUid: number | undefined) {
  useEffect(() => {
    if (!empUid || !naverAvailable()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, CHANGE_DEBOUNCE_MS);
    };
    const run = async () => {
      try {
        await syncNaver(empUid);
        // 동기화 도중 생긴 변경은 이번 회차에 못 올라갔을 수 있음
        const s = state.status;
        if (s?.connected && s.empUid === empUid && hasPendingChanges(empUid)) schedule();
      } catch { /* lastError로 표시 */ }
    };
    const onChange = () => {
      if (inflight || !hasPendingChanges(empUid)) return;
      schedule();
    };
    run();
    const interval = setInterval(run, AUTO_SYNC_MS);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [empUid]);
}
