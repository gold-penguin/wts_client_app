// 네이버 캘린더(CalDAV) — Electron 메인 프로세스(electron/naverCalendar.cjs)를 IPC로 호출
import type { PlannerItem } from '../types/planner';

export interface NaverCalendar {
  url: string;
  name: string;
  /** 네이버에 설정된 캘린더 색 (#rrggbb), 없으면 null */
  color: string | null;
}

export interface NaverStatus {
  available: boolean;
  connected: boolean;
  username: string | null;
  /** 동기화하도록 선택한 캘린더들 */
  calendars: NaverCalendar[];
  empUid: number | null;
}

/** 원격 일정 1건(반복 일정은 회차별로 펼쳐짐) */
export type RemoteEvent = Required<Pick<PlannerItem, 'external_id' | 'external_hash' | 'title' | 'date' | 'calendar_url'>> &
  Pick<PlannerItem, 'note' | 'end_date' | 'start_time' | 'end_time' | 'readonly'>;

export type EventFields = Pick<PlannerItem, 'title' | 'note' | 'date' | 'end_date' | 'start_time' | 'end_time'>;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface NaverBridge {
  status: () => Promise<Result<NaverStatus>>;
  connect: (creds: { username: string; password: string }) => Promise<Result<NaverCalendar[]>>;
  listCalendars: () => Promise<Result<NaverCalendar[]>>;
  selectCalendars: (arg: { calendars: NaverCalendar[]; empUid: number }) => Promise<Result<void>>;
  disconnect: () => Promise<Result<void>>;
  fetchEvents: (range: { start: string; end: string }) => Promise<Result<RemoteEvent[]>>;
  createEvent: (arg: { fields: EventFields; calendarUrl: string }) => Promise<Result<{ external_id: string; external_hash: string | null }>>;
  updateEvent: (arg: { href: string; fields: EventFields }) => Promise<Result<{ deleted: boolean; external_hash?: string | null }>>;
  deleteEvent: (arg: { href: string }) => Promise<Result<void>>;
}

const bridge = (): NaverBridge | undefined =>
  (window as unknown as { wtsElectron?: { naver?: NaverBridge } }).wtsElectron?.naver;

/** Electron 앱에서만 사용 가능 (브라우저 개발 모드에서는 false) */
export const naverAvailable = () => !!bridge();

async function call<T>(fn: (b: NaverBridge) => Promise<Result<T>>): Promise<T> {
  const b = bridge();
  if (!b) throw new Error('네이버 캘린더 연동은 데스크톱 앱에서만 사용할 수 있습니다.');
  const res = await fn(b);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export const naverApi = {
  status: () => call(b => b.status()),
  connect: (username: string, password: string) => call(b => b.connect({ username, password })),
  listCalendars: () => call(b => b.listCalendars()),
  selectCalendars: (calendars: NaverCalendar[], empUid: number) => call(b => b.selectCalendars({ calendars, empUid })),
  disconnect: () => call(b => b.disconnect()),
  fetchEvents: (start: Date, end: Date) => call(b => b.fetchEvents({ start: start.toISOString(), end: end.toISOString() })),
  createEvent: (fields: EventFields, calendarUrl: string) => call(b => b.createEvent({ fields, calendarUrl })),
  updateEvent: (href: string, fields: EventFields) => call(b => b.updateEvent({ href, fields })),
  deleteEvent: (href: string) => call(b => b.deleteEvent({ href })),
};
