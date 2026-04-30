import { useState, useEffect } from 'react';
import { weeklyApi } from '../api/weekly';
import { getUser } from '../stores/authStore';

interface Job {
  JOB_UID: number;
  JOB_NAME: string;
  JOB_SCOPE_CODE?: string;
}

interface PrevNote {
  JOB_UID: number;
  THISWEEK_NOTE: string;
}

interface IndividualEntry {
  WREPORT_CHARGE_UID: number;
  JOB_UID: number;
  JOB_NAME: string;
  THISWEEK_NOTE: string;
  NEXTWEEK_NOTE?: string;
  TOTAL_HOURS?: number;
}

interface Entry {
  job_uid: number;
  job_name: string;
  scope_code: string;
  wreport_charge_uid: number | null;
  thisweek_note: string;
  nextweek_note: string;
  prev_thisweek_note?: string;
  total_hours?: number;
}

function getCurrentWeek(): string {
  const now = new Date();
  // 업무기록 주기는 금~목. 그 주에 포함된 월요일의 (달, ceil(day/7))로 주차 라벨링.
  // 오늘이 속한 금~목 주의 목요일을 먼저 구한 뒤 거기서 -3일 = 월요일.
  const daysUntilThu = (4 - now.getDay() + 7) % 7; // Thu=4
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilThu - 3);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const week = Math.ceil(monday.getDate() / 7);
  return `${year}${month}${week}`;
}

export default function WeeklyPage() {
  const user = getUser()!;
  const [week, setWeek] = useState(getCurrentWeek);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<number, { thisweek: string; nextweek: string }>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [myJobsRes, individualRes] = await Promise.all([
        weeklyApi.myJobs(user.emp_uid, week),
        weeklyApi.individual(user.emp_uid, week),
      ]);
      const jobs: Job[] = myJobsRes.data?.jobs || [];
      const prevNotes: PrevNote[] = myJobsRes.data?.prev_notes || [];
      const individual: IndividualEntry[] = individualRes.data?.data || individualRes.data || [];

      const indByJob = new Map(individual.map(e => [e.JOB_UID, e]));
      const prevByJob = new Map(prevNotes.map(p => [p.JOB_UID, p.THISWEEK_NOTE]));

      const merged: Entry[] = jobs.map(j => {
        const ex = indByJob.get(j.JOB_UID);
        return {
          job_uid: j.JOB_UID,
          job_name: j.JOB_NAME,
          scope_code: (j.JOB_SCOPE_CODE || '').toUpperCase(),
          wreport_charge_uid: ex?.WREPORT_CHARGE_UID ?? null,
          thisweek_note: ex?.THISWEEK_NOTE ?? '',
          nextweek_note: ex?.NEXTWEEK_NOTE ?? '',
          prev_thisweek_note: prevByJob.get(j.JOB_UID),
          total_hours: ex?.TOTAL_HOURS,
        };
      });

      // myJobs에 없는데 individual에만 있는 항목도 살림 (과거 주차 등)
      individual.forEach(ie => {
        if (!jobs.some(j => j.JOB_UID === ie.JOB_UID)) {
          merged.push({
            job_uid: ie.JOB_UID,
            job_name: ie.JOB_NAME,
            scope_code: '',
            wreport_charge_uid: ie.WREPORT_CHARGE_UID,
            thisweek_note: ie.THISWEEK_NOTE ?? '',
            nextweek_note: ie.NEXTWEEK_NOTE ?? '',
            total_hours: ie.TOTAL_HOURS,
          });
        }
      });

      setEntries(merged);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [week]);

  const startEdit = () => {
    const data: Record<number, { thisweek: string; nextweek: string }> = {};
    entries.forEach(e => {
      data[e.job_uid] = { thisweek: e.thisweek_note, nextweek: e.nextweek_note };
    });
    setEditData(data);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // 1단계: saveIndividual — 신규 행 INSERT + 기존 행의 thisweek_note UPDATE
      const saveEntries = entries
        .map(e => {
          const ed = editData[e.job_uid];
          const thisweek = ed?.thisweek ?? e.thisweek_note;
          return {
            job_uid: e.job_uid,
            wreport_charge_uid: e.wreport_charge_uid ?? undefined,
            thisweek_note: thisweek,
          };
        })
        // 빈 신규 항목은 건드리지 않음 (기존 행은 비우는 동작도 허용)
        .filter(s => s.wreport_charge_uid !== undefined || s.thisweek_note.trim().length > 0);

      if (saveEntries.length > 0) {
        await weeklyApi.saveIndividual({
          emp_uid: user.emp_uid,
          week,
          entries: saveEntries,
        });
      }

      // 2단계: 신규 wreport_charge_uid 받기 위해 재조회
      const indRes = await weeklyApi.individual(user.emp_uid, week);
      const refreshed: IndividualEntry[] = indRes.data?.data || indRes.data || [];
      const refByJob = new Map(refreshed.map(e => [e.JOB_UID, e]));

      // 3단계: nextweek_note는 saveIndividual 스키마에 없으니 updateIndividual로 반영
      const updates = entries
        .map(e => {
          const ed = editData[e.job_uid];
          if (!ed) return null;
          const ref = refByJob.get(e.job_uid);
          if (!ref) return null; // 저장 후에도 행이 없으면 스킵 (빈 입력)
          return {
            wreport_charge_uid: ref.WREPORT_CHARGE_UID,
            thisweek_note: ed.thisweek,
            nextweek_note: ed.nextweek,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (updates.length > 0) {
        await weeklyApi.updateIndividual(updates);
      }

      setEditMode(false);
      setEditData({});
      await fetchData();
    } catch (err) { console.error(err); alert('저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-700">📊 주간 보고</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">주차:</label>
          <input type="text" value={week} onChange={e => setWeek(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="YYYYMMW" />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 mb-4">
        {!editMode && entries.length > 0 && (
          <button onClick={startEdit} className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">수정</button>
        )}
        {editMode && (
          <>
            <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">{saving ? '저장 중...' : '저장'}</button>
            <button onClick={cancelEdit} className="px-4 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors">취소</button>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">담당 업무가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.job_uid} className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {entry.scope_code && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-200 shrink-0">{entry.scope_code}</span>
                  )}
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 truncate">{entry.job_name}</h3>
                </div>
                {entry.total_hours !== undefined && (
                  <span className="text-xs sm:text-sm font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">{entry.total_hours}h</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs font-medium text-blue-400 mb-1">금주 실적</p>
                  {editMode ? (
                    <textarea
                      value={editData[entry.job_uid]?.thisweek ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, [entry.job_uid]: { ...prev[entry.job_uid], thisweek: e.target.value } }))}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-2.5">{entry.thisweek_note || '-'}</p>
                  )}
                  {entry.prev_thisweek_note && (
                    <p className="text-[11px] text-gray-400 mt-1 truncate" title={entry.prev_thisweek_note}>전주: {entry.prev_thisweek_note}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-green-400 mb-1">차주 계획</p>
                  {editMode ? (
                    <textarea
                      value={editData[entry.job_uid]?.nextweek ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, [entry.job_uid]: { ...prev[entry.job_uid], nextweek: e.target.value } }))}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-2.5">{entry.nextweek_note || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
