import { useEffect, useState } from 'react';
import { addItem, deleteItem, toggleDone, toYmd, fromYmd, byTime, isDueBy, occursOn } from '../stores/plannerStore';
import type { PlannerItem, PlannerKind } from '../types/planner';
import { getUploadDefault, setUploadDefault, isNaverLinked, useNaverSyncState, refreshNaverStatus } from '../stores/naverSync';

interface Props {
  empUid: number;
  items: PlannerItem[];
}

// 마지막으로 고른 빠른 추가 종류 (이 PC 편의 설정)
const KIND_KEY = 'wts_widget_add_kind';
const loadKind = (): PlannerKind => {
  try { return localStorage.getItem(KIND_KEY) === 'event' ? 'event' : 'todo'; } catch { return 'todo'; }
};

const pad = (n: number) => String(n).padStart(2, '0');
/** 다음 정시 ~ +1시간 */
const nextHourSlot = () => {
  const h = Math.min(new Date().getHours() + 1, 23);
  return { start: `${pad(h)}:00`, end: h < 23 ? `${pad(h + 1)}:00` : '23:59' };
};

const shortDate = (ymd: string) => {
  const d = fromYmd(ymd);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 위젯 '할 일' 탭 — 오늘 일정 + 챙겨야 할 할 일을 보여 주고 체크/빠른 추가만 지원
// 빠른 추가는 할 일 또는 오늘 일정(네이버 연동 시 네이버 캘린더에도 올라감)
export default function WidgetPlanner({ empUid, items }: Props) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PlannerKind>(loadKind);
  const [allDay, setAllDay] = useState(false);
  const [slot, setSlot] = useState(nextHourSlot);
  const [upload, setUpload] = useState(getUploadDefault);
  const naverLinked = isNaverLinked(useNaverSyncState(), empUid);
  // 위젯 창은 동기화를 돌리지 않으므로 연동 여부만 따로 조회
  useEffect(() => { refreshNaverStatus(); }, []);
  const today = toYmd(new Date());

  const chooseKind = (k: PlannerKind) => {
    setKind(k);
    if (k === 'event') setSlot(nextHourSlot());
    try { localStorage.setItem(KIND_KEY, k); } catch { /* 편의 설정일 뿐 */ }
  };

  const events = items.filter(i => i.kind === 'event' && occursOn(i, today)).sort(byTime);
  const todos = items
    .filter(i => isDueBy(i, today) || (i.kind === 'todo' && !i.done && !i.date))
    .sort((a, b) => (a.date || '99999999').localeCompare(b.date || '99999999') || a.created_at.localeCompare(b.created_at));
  const doneToday = items.filter(i => i.kind === 'todo' && i.done && i.date === today);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (kind === 'event') {
      if (!allDay && slot.end <= slot.start) { alert('종료 시간이 시작 시간보다 늦어야 합니다.'); return; }
      addItem(empUid, {
        kind: 'event',
        title: t,
        date: today,
        start_time: allDay ? undefined : slot.start,
        end_time: allDay ? undefined : slot.end,
        local_only: naverLinked && !upload ? true : undefined,
      });
      if (naverLinked) setUploadDefault(upload);
    } else {
      addItem(empUid, { kind: 'todo', title: t, date: today, done: false });
    }
    setTitle('');
  };

  const row = (item: PlannerItem) => (
    <div key={item.id} className="widget-card group flex items-start gap-2">
      {item.kind === 'todo' ? (
        <input
          type="checkbox"
          checked={!!item.done}
          onChange={() => toggleDone(empUid, item.id)}
          className="mt-0.5 w-3.5 h-3.5 shrink-0 cursor-pointer"
        />
      ) : (
        <span className="mt-1 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold truncate leading-snug ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {item.external_id && <span className="inline-block mr-1 px-1 rounded bg-green-500 text-white text-[9px] font-black align-middle">N</span>}
          {item.title}
        </div>
        {item.kind === 'event' && (
          <div className="text-[11px] text-gray-400 leading-tight mt-0.5">
            {item.start_time ? `${item.start_time}${item.end_time ? ` ~ ${item.end_time}` : ''}` : '종일'}
          </div>
        )}
        {item.kind === 'todo' && item.date && item.date < today && !item.done && (
          <div className="text-[11px] text-red-400 leading-tight mt-0.5">{shortDate(item.date)} 마감</div>
        )}
      </div>
      {!item.readonly && <button
        onClick={() => deleteItem(empUid, item.id)}
        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
        title="삭제"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
      </button>}
    </div>
  );

  const section = (label: string, list: PlannerItem[]) =>
    list.length > 0 && (
      <div>
        <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">{label}</div>
        <div className="space-y-1">{list.map(row)}</div>
      </div>
    );

  return (
    <div className="px-2 py-1.5 space-y-2.5">
      <form onSubmit={handleAdd} className="space-y-1.5">
        <div className="flex gap-1">
          {(['todo', 'event'] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => chooseKind(k)}
              className={`widget-chip ${kind === k ? 'widget-chip-active' : ''}`}
            >
              {k === 'todo' ? '할 일' : '일정'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={kind === 'todo' ? '오늘 할 일 추가 (Enter)' : '오늘 일정 추가 (Enter)'}
          className="widget-input w-full"
        />
        {kind === 'event' && (
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              value={slot.start}
              disabled={allDay}
              onChange={e => setSlot(s => ({ ...s, start: e.target.value }))}
              className="widget-input flex-1 min-w-0 disabled:opacity-40"
            />
            <span className="text-[11px] text-gray-400">~</span>
            <input
              type="time"
              value={slot.end}
              disabled={allDay}
              onChange={e => setSlot(s => ({ ...s, end: e.target.value }))}
              className="widget-input flex-1 min-w-0 disabled:opacity-40"
            />
            <label className="flex items-center gap-1 text-[11px] text-gray-500 shrink-0 cursor-pointer select-none">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-3 h-3" />
              종일
            </label>
          </div>
        )}
        {kind === 'event' && naverLinked && (
          <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer select-none px-0.5">
            <input type="checkbox" checked={upload} onChange={e => setUpload(e.target.checked)} className="w-3 h-3" />
            <span className="inline-block px-1 rounded bg-green-500 text-white text-[9px] font-black">N</span>
            네이버 캘린더에 올리기
          </label>
        )}
      </form>
      {events.length === 0 && todos.length === 0 && doneToday.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2 opacity-40">&#9989;</div>
          <p className="text-xs text-gray-400">오늘 챙길 일정·할 일이 없습니다</p>
        </div>
      ) : (
        <>
          {section('오늘 일정', events)}
          {section('할 일', todos)}
          {section('완료', doneToday)}
        </>
      )}
      <p className="text-[10px] text-gray-300 text-center">WTS에 올라가지 않는 개인 메모 · 메인 창 '내 일정'에서 전체 보기</p>
    </div>
  );
}
