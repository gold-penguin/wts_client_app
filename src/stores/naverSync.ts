import { useEffect, useSyncExternalStore } from 'react';
import { naverApi, naverAvailable, type EventFields, type NaverStatus, type RemoteEvent } from '../api/naverCalendar';
import {
  CHANGE_EVENT, loadItems, replaceItems, loadDeleted, clearDeleted, isDirty, newId, toYmd,
} from './plannerStore';
import type { PlannerItem } from '../types/planner';

// 네이버 캘린더 ↔ 로컬 일정 동기화. 메인 창에서만 실행한다(위젯의 변경은 storage 이벤트로 감지).
// 순서: ① 로컬에서 지운 일정 원격 삭제 → ② 로컬 변경 업로드 → ③ 원격 일정 내려받아 반영.
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
  readonly: r.readonly || undefined,
});

/** 업로드 결과 반영. 업로드 도중 사용자가 또 고쳤다면(rev가 바뀜) synced_rev를 올리지 않아 다음 동기화 때 다시 올라간다. */
function markPushed(empUid: number, id: string, sentRev: number, meta: Partial<PlannerItem>) {
  replaceItems(empUid, loadItems(empUid).map(i => {
    if (i.id !== id) return i;
    return (i.rev ?? 0) === sentRev ? { ...i, ...meta, synced_rev: sentRev } : { ...i, ...meta };
  }));
}

/** 할 일로 바뀐 동기화 일정 → 원격에서는 지우고 로컬 연결 정보 제거 */
function unlink(empUid: number, id: string) {
  replaceItems(empUid, loadItems(empUid).map(i =>
    i.id === id ? { ...i, external_id: undefined, external_hash: undefined, synced_rev: undefined, readonly: undefined } : i,
  ));
}

const needsPush = (i: PlannerItem) =>
  (i.kind === 'event' && !i.readonly && !!i.date && isDirty(i)) || (i.kind === 'todo' && !!i.external_id);

export function hasPendingChanges(empUid: number) {
  return loadDeleted(empUid).length > 0 || loadItems(empUid).some(needsPush);
}

async function push(empUid: number) {
  const deleted = loadDeleted(empUid);
  for (const href of deleted) await naverApi.deleteEvent(href);
  if (deleted.length) clearDeleted(empUid, deleted);

  for (const item of loadItems(empUid).filter(needsPush)) {
    if (item.kind === 'todo') {
      if (!item.readonly) await naverApi.deleteEvent(item.external_id!);
      unlink(empUid, item.id);
      continue;
    }
    const fields = fieldsOf(item);
    if (item.external_id) {
      const res = await naverApi.updateEvent(item.external_id, fields);
      if (!res.deleted) {
        markPushed(empUid, item.id, item.rev ?? 0, { external_hash: res.external_hash ?? undefined });
        continue;
      }
      // 원격에서 지워진 일정을 로컬에서 고쳤다면 새로 만든다
    }
    const res = await naverApi.createEvent(fields);
    markPushed(empUid, item.id, item.rev ?? 0, { external_id: res.external_id, external_hash: res.external_hash ?? undefined });
  }
}

async function pull(empUid: number) {
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
      // 조회 범위 안인데 원격에 없으면 네이버에서 삭제된 것. 로컬에서 고치는 중이면 남겨 두고 다음에 다시 올린다.
      const inRange = !!item.date && item.date >= startYmd && item.date < endYmd;
      if (inRange && !isDirty(item)) continue;
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

/** 연결 해제·캘린더 변경 시: 네이버와 연결된 일정을 앱에서만 지운다 (네이버에는 그대로 남음) */
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
    await push(empUid);
    await pull(empUid);
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
