import { useMemo, useState } from 'react';
import { getUser } from '../stores/authStore';
import {
  usePlannerItems, addItem, updateItem, deleteItem, toggleDone,
  toYmd, fromYmd, ymdToInput, inputToYmd, byTime, isDueBy,
} from '../stores/plannerStore';
import NaverSyncBar from '../components/NaverSyncBar';
import { getUploadDefault, setUploadDefault, isNaverLinked, useNaverSyncState } from '../stores/naverSync';
import type { PlannerItem, PlannerKind, PlannerFields } from '../types/planner';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface FormState {
  kind: PlannerKind;
  title: string;
  date: string; // YYYY-MM-DD (input 값)
  endDate: string; // 여러 날 일정의 마지막 날, 비우면 하루
  allDay: boolean;
  start_time: string;
  end_time: string;
  note: string;
  /** 일정을 네이버 캘린더에 올릴지 */
  upload: boolean;
}

const emptyForm = (kind: PlannerKind, ymd?: string): FormState => ({
  kind,
  title: '',
  date: ymdToInput(ymd),
  endDate: '',
  allDay: true,
  start_time: '09:00',
  end_time: '10:00',
  note: '',
  upload: getUploadDefault(),
});

const formFromItem = (item: PlannerItem): FormState => ({
  kind: item.kind,
  title: item.title,
  date: ymdToInput(item.date),
  endDate: ymdToInput(item.end_date),
  allDay: !item.start_time,
  start_time: item.start_time || '09:00',
  end_time: item.end_time || '10:00',
  note: item.note || '',
  upload: !item.local_only,
});

const dateLabel = (ymd: string) => {
  const d = fromYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};

const shortYmd = (ymd: string) => `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`;

const timeLabel = (item: PlannerItem) => {
  const time = item.start_time ? `${item.start_time}${item.end_time ? `~${item.end_time}` : ''}` : '종일';
  return item.end_date ? `${time} (~${shortYmd(item.end_date)})` : time;
};

const MAX_SPAN_DAYS = 62;

export default function PlannerPage() {
  const user = getUser()!;
  const naverLinked = isNaverLinked(useNaverSyncState(), user.emp_uid);
  const items = usePlannerItems(user.emp_uid);
  const today = toYmd(new Date());

  const [selected, setSelected] = useState(today);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [quickTodo, setQuickTodo] = useState('');

  // 날짜별 항목 (일정 + 마감일 있는 할 일)
  const byDate = useMemo(() => {
    const map = new Map<string, PlannerItem[]>();
    const put = (ymd: string, i: PlannerItem) => {
      const list = map.get(ymd) ?? [];
      list.push(i);
      map.set(ymd, list);
    };
    for (const i of items) {
      if (!i.date) continue;
      put(i.date, i);
      if (!i.end_date || i.end_date <= i.date) continue;
      const d = fromYmd(i.date);
      for (let n = 1; n <= MAX_SPAN_DAYS; n++) {
        d.setDate(d.getDate() + 1);
        const ymd = toYmd(d);
        if (ymd > i.end_date) break;
        put(ymd, i);
      }
    }
    for (const list of map.values()) list.sort(byTime);
    return map;
  }, [items]);

  const selectedItems = byDate.get(selected) ?? [];
  const overdue = items.filter(i => isDueBy(i, today) && i.date! < today).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = items
    .filter(i => i.kind === 'todo' && !i.date)
    .sort((a, b) => Number(!!a.done) - Number(!!b.done) || a.created_at.localeCompare(b.created_at));

  // 달력 셀: 해당 월 1일이 속한 주의 일요일부터 6주
  const cells = useMemo(() => {
    const start = new Date(viewMonth);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  const moveMonth = (delta: number) =>
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const goToday = () => {
    const d = new Date();
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(today);
  };

  const selectDate = (d: Date) => {
    setSelected(toYmd(d));
    if (d.getMonth() !== viewMonth.getMonth()) setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const openNew = (kind: PlannerKind, ymd?: string) => {
    setEditingId(null);
    setForm(emptyForm(kind, ymd));
  };

  const openEdit = (item: PlannerItem) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
  };

  const editingItem = editingId ? items.find(i => i.id === editingId) : undefined;
  const readonly = !!editingItem?.readonly;

  const closeForm = () => {
    setEditingId(null);
    setForm(null);
  };

  const handleSave = () => {
    if (!form) return;
    const title = form.title.trim();
    if (!title) { alert('제목을 입력해주세요.'); return; }
    if (form.kind === 'event' && !form.date) { alert('일정 날짜를 선택해주세요.'); return; }
    const isEvent = form.kind === 'event';
    if (isEvent && form.endDate && form.endDate < form.date) { alert('종료일이 시작일보다 빠릅니다.'); return; }
    const endDate = isEvent && form.endDate && form.endDate > form.date ? inputToYmd(form.endDate) : undefined;
    if (isEvent && !form.allDay && !endDate && form.end_time < form.start_time) {
      alert('종료 시간이 시작 시간보다 빠릅니다.');
      return;
    }
    const isTimed = isEvent && !form.allDay;
    const draft: PlannerFields = {
      kind: form.kind,
      title,
      note: form.note.trim() || undefined,
      date: form.date ? inputToYmd(form.date) : undefined,
      end_date: endDate,
      start_time: isTimed ? form.start_time : undefined,
      end_time: isTimed ? form.end_time : undefined,
      local_only: isEvent && !form.upload ? true : undefined,
    };
    if (isEvent && naverLinked && !readonly) setUploadDefault(form.upload);
    if (editingId) {
      updateItem(user.emp_uid, editingId, draft);
    } else {
      addItem(user.emp_uid, { ...draft, done: form.kind === 'todo' ? false : undefined });
    }
    if (draft.date) setSelected(draft.date);
    closeForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    deleteItem(user.emp_uid, id);
    if (editingId === id) closeForm();
  };

  const handleQuickTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTodo.trim();
    if (!title) return;
    addItem(user.emp_uid, { kind: 'todo', title, done: false });
    setQuickTodo('');
  };

  const renderRow = (item: PlannerItem, opts?: { showDate?: boolean }) => (
    <div
      key={item.id}
      className={`group flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer ${
        editingId === item.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'
      }`}
      onClick={() => openEdit(item)}
    >
      {item.kind === 'todo' ? (
        <input
          type="checkbox"
          checked={!!item.done}
          onClick={e => e.stopPropagation()}
          onChange={() => toggleDone(user.emp_uid, item.id)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0 cursor-pointer"
        />
      ) : (
        <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {item.external_id && (
            <span
              className="inline-block mr-1 px-1 rounded bg-green-500 text-white text-[9px] font-black align-middle"
              title={item.readonly ? '네이버 반복 일정 (네이버에서 수정)' : '네이버 캘린더와 동기화됨'}
            >
              N
            </span>
          )}
          {item.title}
        </div>
        <div className="text-xs text-gray-400">
          {opts?.showDate && item.date && <span className="text-red-400 mr-1.5">{dateLabel(item.date)}</span>}
          {item.kind === 'event' ? timeLabel(item) : item.date ? (opts?.showDate ? '마감' : '할 일') : ''}
        </div>
        {item.note && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2 whitespace-pre-wrap">{item.note}</div>}
      </div>
      {!item.readonly && (
        <button
          onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
          className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="삭제"
        >
          삭제
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 mb-4 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-700">🗓️ 내 일정</h2>
          <p className="text-xs text-gray-400 mt-0.5">WTS에 올라가지 않는 개인 할 일·일정이에요. 일정은 네이버 캘린더와 동기화할 수 있어요.</p>
        </div>
        <div className="sm:text-right">
          <NaverSyncBar empUid={user.emp_uid} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── 달력 ── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span className="text-base font-bold text-gray-700 w-28 text-center">{viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월</span>
              <button onClick={() => moveMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <button onClick={goToday} className="text-xs text-blue-500 hover:underline">오늘</button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
            {cells.map(d => {
              const ymd = toYmd(d);
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const dayItems = byDate.get(ymd) ?? [];
              const isSel = ymd === selected;
              const isToday = ymd === today;
              return (
                <button
                  key={ymd}
                  onClick={() => selectDate(d)}
                  onDoubleClick={() => openNew('event', ymd)}
                  className={`min-h-[76px] p-1 text-left align-top flex flex-col transition-colors ${
                    isSel ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  <span className={`text-xs w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-blue-500 text-white font-bold' : d.getDay() === 0 ? 'text-red-400' : d.getDay() === 6 ? 'text-blue-400' : 'text-gray-600'
                  }`}>
                    {d.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5 w-full min-w-0">
                    {dayItems.slice(0, 3).map(i => (
                      <div
                        key={i.id}
                        className={`text-[10px] leading-tight truncate rounded px-1 ${
                          i.kind === 'event'
                            ? 'bg-indigo-50 text-indigo-600'
                            : i.done ? 'text-gray-300 line-through' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {i.kind === 'todo' ? (i.done ? '☑ ' : '☐ ') : i.start_time ? `${i.start_time} ` : ''}{i.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{dayItems.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-300 mt-2">날짜를 더블클릭하면 바로 일정을 추가할 수 있어요.</p>
        </div>

        {/* ── 사이드 패널 ── */}
        <div className="w-full lg:w-96 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">
                {dateLabel(selected)}
                {selected === today && <span className="ml-1.5 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">오늘</span>}
              </h3>
              <div className="flex gap-1">
                <button onClick={() => openNew('event', selected)} className="px-2.5 py-1 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">+ 일정</button>
                <button onClick={() => openNew('todo', selected)} className="px-2.5 py-1 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">+ 할 일</button>
              </div>
            </div>

            {/* 입력 폼 */}
            {form && (
              <div className="mb-3 p-3 rounded-lg border border-blue-200 bg-blue-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {(['event', 'todo'] as const).map(k => (
                      <button
                        key={k}
                        onClick={() => setForm(f => f && { ...f, kind: k })}
                        className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                          form.kind === k ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200'
                        }`}
                      >
                        {k === 'event' ? '일정' : '할 일'}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-blue-600">{readonly ? '보기' : editingId ? '수정' : '새 항목'}</span>
                </div>
                {readonly && (
                  <p className="text-[11px] text-green-700 bg-green-50 rounded px-2 py-1">네이버 반복 일정이에요. 수정·삭제는 네이버 캘린더에서 해 주세요.</p>
                )}
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => f && { ...f, title: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  placeholder="제목"
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => f && { ...f, date: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  />
                  {form.kind === 'todo' && form.date && (
                    <button onClick={() => setForm(f => f && { ...f, date: '' })} className="text-xs text-gray-400 hover:text-gray-600">마감일 없음</button>
                  )}
                  {form.kind === 'event' && (
                    <>
                      <span className="text-gray-400 text-sm">~</span>
                      <input
                        type="date"
                        value={form.endDate}
                        min={form.date}
                        onChange={e => setForm(f => f && { ...f, endDate: e.target.value })}
                        title="여러 날 일정이면 마지막 날 (비우면 하루)"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      />
                    </>
                  )}
                  {form.kind === 'event' && (
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                      <input type="checkbox" checked={form.allDay} onChange={e => setForm(f => f && { ...f, allDay: e.target.checked })} className="w-3.5 h-3.5" />
                      종일
                    </label>
                  )}
                </div>
                {form.kind === 'event' && naverLinked && !readonly && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.upload}
                      onChange={e => setForm(f => f && { ...f, upload: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="inline-block px-1 rounded bg-green-500 text-white text-[9px] font-black">N</span>
                    네이버 캘린더에 올리기
                    {editingItem?.external_id && !form.upload && <span className="text-orange-500">(네이버에서는 지워져요)</span>}
                  </label>
                )}
                {form.kind === 'event' && !form.allDay && (
                  <div className="flex items-center gap-1.5">
                    <input type="time" value={form.start_time} onChange={e => setForm(f => f && { ...f, start_time: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
                    <span className="text-gray-400 text-sm">~</span>
                    <input type="time" value={form.end_time} onChange={e => setForm(f => f && { ...f, end_time: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
                  </div>
                )}
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => f && { ...f, note: e.target.value })}
                  placeholder="메모 (선택)"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <div className="flex justify-between">
                  {editingId && !readonly ? (
                    <button onClick={() => handleDelete(editingId)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                  ) : <span />}
                  <div className="flex gap-1.5">
                    <button onClick={closeForm} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-white rounded-lg">취소</button>
                    {!readonly && (
                      <button onClick={handleSave} className="px-4 py-1.5 text-xs bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600">{editingId ? '수정' : '저장'}</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedItems.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">등록된 일정·할 일이 없습니다</p>
            ) : (
              <div className="space-y-1.5">{selectedItems.map(i => renderRow(i))}</div>
            )}
          </div>

          {overdue.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-red-500 mb-2">마감 지난 할 일 ({overdue.length})</h3>
              <div className="space-y-1.5">{overdue.map(i => renderRow(i, { showDate: true }))}</div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">날짜 없는 할 일</h3>
            <form onSubmit={handleQuickTodo} className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={quickTodo}
                onChange={e => setQuickTodo(e.target.value)}
                placeholder="할 일 입력 후 Enter"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button type="submit" className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 shrink-0">추가</button>
            </form>
            {undated.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">없음</p>
            ) : (
              <div className="space-y-1.5">{undated.map(i => renderRow(i))}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
