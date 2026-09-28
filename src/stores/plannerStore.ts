import { useSyncExternalStore } from 'react';
import type { PlannerDraft, PlannerItem } from '../types/planner';

// 사용자별로 분리해 localStorage에 저장. 메인 창과 위젯은 같은 origin이라 저장소를 공유하고,
// 다른 창의 변경은 'storage' 이벤트로, 같은 창의 변경은 CHANGE_EVENT로 반영한다.
// 저장된 배열은 불변으로 다룬다(항상 새 배열을 저장) — 스냅샷 캐시가 이를 전제로 함.
const keyOf = (empUid: number) => `wts_planner_${empUid}`;
// 네이버와 동기화된 일정을 로컬에서 지운 기록 — 다음 동기화 때 원격에서도 삭제
const deletedKeyOf = (empUid: number) => `wts_planner_${empUid}_deleted`;
export const CHANGE_EVENT = 'planner-changed';

// useSyncExternalStore는 스냅샷이 매번 같은 참조여야 하므로 원문이 같으면 파싱 결과를 재사용
const cache = new Map<string, { raw: string | null; items: PlannerItem[] }>();

export function loadItems(empUid: number): PlannerItem[] {
  const key = keyOf(empUid);
  const raw = localStorage.getItem(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.items;
  let items: PlannerItem[] = [];
  try {
    items = raw ? (JSON.parse(raw) as PlannerItem[]) : [];
  } catch { /* 손상된 데이터는 빈 목록으로 취급 */ }
  cache.set(key, { raw, items });
  return items;
}

/** 동기화 결과를 한 번에 반영 (rev를 건드리지 않음) */
export function replaceItems(empUid: number, items: PlannerItem[]) {
  saveItems(empUid, items);
}

export function loadDeleted(empUid: number): string[] {
  try {
    return JSON.parse(localStorage.getItem(deletedKeyOf(empUid)) || '[]') as string[];
  } catch {
    return [];
  }
}

export function clearDeleted(empUid: number, hrefs: string[]) {
  const rest = loadDeleted(empUid).filter(h => !hrefs.includes(h));
  if (rest.length) localStorage.setItem(deletedKeyOf(empUid), JSON.stringify(rest));
  else localStorage.removeItem(deletedKeyOf(empUid));
}

function saveItems(empUid: number, items: PlannerItem[]) {
  localStorage.setItem(keyOf(empUid), JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function addItem(empUid: number, draft: PlannerDraft): PlannerItem {
  const now = new Date().toISOString();
  const item: PlannerItem = { ...draft, id: newId(), created_at: now, updated_at: now, rev: 1 };
  saveItems(empUid, [...loadItems(empUid), item]);
  return item;
}

export function updateItem(empUid: number, id: string, patch: Partial<PlannerDraft>) {
  const now = new Date().toISOString();
  saveItems(empUid, loadItems(empUid).map(i => (i.id === id ? { ...i, ...patch, updated_at: now, rev: (i.rev ?? 0) + 1 } : i)));
}

export function deleteItem(empUid: number, id: string) {
  const item = loadItems(empUid).find(i => i.id === id);
  if (item?.external_id && !item.readonly) {
    localStorage.setItem(deletedKeyOf(empUid), JSON.stringify([...loadDeleted(empUid), item.external_id]));
  }
  saveItems(empUid, loadItems(empUid).filter(i => i.id !== id));
}

export function toggleDone(empUid: number, id: string) {
  const item = loadItems(empUid).find(i => i.id === id);
  if (item) updateItem(empUid, id, { done: !item.done });
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const EMPTY: PlannerItem[] = [];

export function usePlannerItems(empUid: number | undefined): PlannerItem[] {
  return useSyncExternalStore(subscribe, () => (empUid ? loadItems(empUid) : EMPTY));
}

// ── 날짜 유틸 ──
export const toYmd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

export const fromYmd = (s: string) =>
  new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));

/** YYYYMMDD ↔ <input type="date"> 값(YYYY-MM-DD) */
export const ymdToInput = (s?: string) => (s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '');
export const inputToYmd = (s: string) => s.replace(/-/g, '');

/** 시간순 정렬: 종일 일정 먼저, 그다음 시작 시간 */
export const byTime = (a: PlannerItem, b: PlannerItem) =>
  (a.start_time || '').localeCompare(b.start_time || '') || a.created_at.localeCompare(b.created_at);

/** 일정이 ymd 날짜에 걸쳐 있는지 (여러 날 일정 포함) */
export const occursOn = (item: PlannerItem, ymd: string) =>
  !!item.date && item.date <= ymd && ymd <= (item.end_date || item.date);

/** 동기화 이후 로컬에서 바뀐 항목 */
export const isDirty = (item: PlannerItem) => item.synced_rev === undefined || item.synced_rev !== (item.rev ?? 0);

/** 미완료이면서 마감일이 ymd 이전(당일 포함)인 할 일 */
export const isDueBy = (item: PlannerItem, ymd: string) =>
  item.kind === 'todo' && !item.done && !!item.date && item.date <= ymd;
