import { useSyncExternalStore } from 'react';

// WTS 서버 연결 상태 — api/client.ts 인터셉터가 갱신하고, 레이아웃/위젯이 안내 배너로 표시
export interface ConnectionState {
  /** 마지막 요청이 연결 실패(응답 없음·타임아웃·게이트웨이 오류)였는지 */
  serverDown: boolean;
  /** '다시 시도'를 누른 뒤 결과를 기다리는 중 */
  retrying: boolean;
}

let state: ConnectionState = { serverDown: false, retrying: false };
const listeners = new Set<() => void>();

function set(next: ConnectionState) {
  if (next.serverDown === state.serverDown && next.retrying === state.retrying) return;
  state = next;
  listeners.forEach(l => l());
}

/** 요청 결과 반영 — 성공하면 배너가 사라지고, 결과가 나오면 '확인 중' 상태가 끝난다 */
export function setServerDown(serverDown: boolean) {
  set({ serverDown, retrying: false });
}

export function markRetrying() {
  set({ ...state, retrying: true });
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
  );
}
