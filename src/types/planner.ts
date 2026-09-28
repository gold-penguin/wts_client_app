// 개인 할 일/일정 — WTS 서버에 올리지 않고 이 PC에만 저장
export type PlannerKind = 'todo' | 'event';

export interface PlannerItem {
  id: string;
  kind: PlannerKind;
  title: string;
  note?: string;
  /** YYYYMMDD. 일정은 필수, 할 일은 마감일(선택) */
  date?: string;
  /** HH:MM. 일정 전용, 없으면 종일 */
  start_time?: string;
  end_time?: string;
  /** 할 일 완료 여부 */
  done?: boolean;
  created_at: string;
  updated_at: string;
  /** 외부 캘린더(네이버 CalDAV 등) 동기화용 예약 필드 */
  external_id?: string;
}

export type PlannerDraft = Omit<PlannerItem, 'id' | 'created_at' | 'updated_at'>;
