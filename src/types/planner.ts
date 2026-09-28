// 개인 할 일/일정 — WTS 서버에 올리지 않고 이 PC에만 저장 (일정은 네이버 캘린더와 동기화 가능)
export type PlannerKind = 'todo' | 'event';

export interface PlannerItem {
  id: string;
  kind: PlannerKind;
  title: string;
  note?: string;
  /** YYYYMMDD. 일정은 필수, 할 일은 마감일(선택) */
  date?: string;
  /** YYYYMMDD. 여러 날 일정의 마지막 날 (포함) */
  end_date?: string;
  /** HH:MM. 일정 전용, 없으면 종일 */
  start_time?: string;
  end_time?: string;
  /** 할 일 완료 여부 */
  done?: boolean;
  created_at: string;
  updated_at: string;

  // ── 네이버 캘린더 동기화 ──
  /** 원격 일정 URL. 반복 일정의 각 회차는 `${url}#${회차}` */
  external_id?: string;
  /** 마지막으로 받은/보낸 원격 ICS 해시 — 원격 변경 감지용 */
  external_hash?: string;
  /** 로컬 수정마다 1씩 증가 */
  rev?: number;
  /** 마지막으로 동기화된 rev. rev와 다르면 로컬 변경이 아직 안 올라간 것 */
  synced_rev?: number;
  /** 네이버 반복 일정 회차 — 앱에서 수정·삭제 불가 */
  readonly?: boolean;
  /** 네이버 캘린더에 올리지 않고 이 PC에만 두는 일정 */
  local_only?: boolean;
}

export type PlannerDraft = Omit<PlannerItem, 'id' | 'created_at' | 'updated_at' | 'rev'>;

/** 편집 가능한 필드 (동기화 메타 제외) */
export type PlannerFields = Pick<PlannerItem, 'kind' | 'title' | 'note' | 'date' | 'end_date' | 'start_time' | 'end_time' | 'done' | 'local_only'>;
