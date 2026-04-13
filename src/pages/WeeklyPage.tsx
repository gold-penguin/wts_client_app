import { useState, useEffect } from 'react';
import { weeklyApi } from '../api/weekly';
import { getUser } from '../stores/authStore';

interface WeeklyEntry {
  WREPORT_CHARGE_UID: number;
  JOB_UID: number;
  JOB_NAME: string;
  THISWEEK_NOTE: string;
  NEXTWEEK_NOTE?: string;
  TOTAL_HOURS?: number;
}

function getCurrentWeek(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const week = Math.ceil((day + firstDay) / 7);
  return `${year}${month}${week}`;
}

export default function WeeklyPage() {
  const user = getUser()!;
  const [week, setWeek] = useState(getCurrentWeek);
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<number, { thisweek: string; nextweek: string }>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await weeklyApi.individual(user.emp_uid, week);
      const data = res.data.data || res.data || [];
      setEntries(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [week]);

  const startEdit = () => {
    const data: Record<number, { thisweek: string; nextweek: string }> = {};
    entries.forEach(e => {
      data[e.WREPORT_CHARGE_UID] = { thisweek: e.THISWEEK_NOTE || '', nextweek: e.NEXTWEEK_NOTE || '' };
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
      const updates = Object.entries(editData).map(([uid, val]) => ({
        wreport_charge_uid: Number(uid),
        thisweek_note: val.thisweek,
        nextweek_note: val.nextweek,
      }));
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
        <div className="text-center py-12 text-gray-400">주간 보고 내역이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.WREPORT_CHARGE_UID} className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 truncate">{entry.JOB_NAME}</h3>
                {entry.TOTAL_HOURS !== undefined && (
                  <span className="text-xs sm:text-sm font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">{entry.TOTAL_HOURS}h</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs font-medium text-blue-400 mb-1">금주 실적</p>
                  {editMode ? (
                    <textarea
                      value={editData[entry.WREPORT_CHARGE_UID]?.thisweek || ''}
                      onChange={e => setEditData(prev => ({ ...prev, [entry.WREPORT_CHARGE_UID]: { ...prev[entry.WREPORT_CHARGE_UID], thisweek: e.target.value } }))}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-2.5">{entry.THISWEEK_NOTE || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-green-400 mb-1">차주 계획</p>
                  {editMode ? (
                    <textarea
                      value={editData[entry.WREPORT_CHARGE_UID]?.nextweek || ''}
                      onChange={e => setEditData(prev => ({ ...prev, [entry.WREPORT_CHARGE_UID]: { ...prev[entry.WREPORT_CHARGE_UID], nextweek: e.target.value } }))}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-2.5">{entry.NEXTWEEK_NOTE || '-'}</p>
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
