import { useState } from 'react';
import { addItem, deleteItem, toggleDone, toYmd, fromYmd, byTime, isDueBy, occursOn } from '../stores/plannerStore';
import type { PlannerItem } from '../types/planner';

interface Props {
  empUid: number;
  items: PlannerItem[];
}

const shortDate = (ymd: string) => {
  const d = fromYmd(ymd);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 위젯 '할 일' 탭 — 오늘 일정 + 챙겨야 할 할 일을 보여 주고 체크/빠른 추가만 지원
export default function WidgetPlanner({ empUid, items }: Props) {
  const [title, setTitle] = useState('');
  const today = toYmd(new Date());

  const events = items.filter(i => i.kind === 'event' && occursOn(i, today)).sort(byTime);
  const todos = items
    .filter(i => isDueBy(i, today) || (i.kind === 'todo' && !i.done && !i.date))
    .sort((a, b) => (a.date || '99999999').localeCompare(b.date || '99999999') || a.created_at.localeCompare(b.created_at));
  const doneToday = items.filter(i => i.kind === 'todo' && i.done && i.date === today);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addItem(empUid, { kind: 'todo', title: t, date: today, done: false });
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
        <div className={`text-xs font-semibold truncate leading-snug ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.title}</div>
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
      <form onSubmit={handleAdd}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="오늘 할 일 추가 (Enter)"
          className="widget-input w-full"
        />
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
