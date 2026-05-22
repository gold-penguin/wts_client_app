import { useState, useEffect, useCallback } from 'react';
import { resultApi } from '../api/result';
import { jobApi } from '../api/job';
import { commonApi } from '../api/common';
import { getUser } from '../stores/authStore';

interface ResultItem {
  REPORT_UID: number;
  JOB_NAME: string;
  JOB_UID: number;
  START_TIME: string;
  END_TIME: string;
  HOURS: number;
  NOTE: string;
  JOB_TYPE_UID?: number;
  JOB_METHOD_UID?: number;
}

interface RecentJob {
  JOB_UID: number;
  JOB_NAME: string;
  JOB_TYPE_UID: number;
  JOB_METHOD_UID: number;
}

const fmtTime = (t: string | number | undefined) => {
  if (t === undefined || t === null || t === '') return '';
  const raw = String(t);
  if (raw.includes(':')) return raw;
  const s = raw.padStart(4, '0');
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const todayLabel = () => {
  const d = new Date();
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`;
};

export default function WidgetPage() {
  const [user, setUserState] = useState(getUser);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  // Quick form
  const [showForm, setShowForm] = useState(false);
  const [editingUid, setEditingUid] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Array<{ JOB_UID: number; JOB_NAME: string; JOB_SCOPE_CODE: string }>>([]);
  const [jobTypes, setJobTypes] = useState<Array<{ JOB_TYPE_UID: number; JOB_TYPE: string; JOB_TYPE_CODE: string; JOB_TYPE_DETAIL: string | null }>>([]);
  const [jobMethods, setJobMethods] = useState<Array<{ JOB_METHOD_UID: number; JOB_METHOD: string }>>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    job_uid: 0,
    job_type_uid: 0,
    job_method_uid: 0,
    start_time: '09:00',
    end_time: '18:00',
    hours: 8,
    note: '',
  });

  useEffect(() => {
    document.body.classList.add('widget-mode');
    return () => { document.body.classList.remove('widget-mode'); };
  }, []);

  // Listen for auth sync from main window
  useEffect(() => {
    const handleAuthSync = () => {
      setUserState(getUser());
    };
    window.addEventListener('auth-sync', handleAuthSync);
    window.addEventListener('focus', handleAuthSync);
    return () => {
      window.removeEventListener('auth-sync', handleAuthSync);
      window.removeEventListener('focus', handleAuthSync);
    };
  }, []);

  const fetchResults = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [dayRes, recentRes] = await Promise.allSettled([
        resultApi.day(user.emp_uid, todayStr()),
        resultApi.recent(user.emp_uid, 20),
      ]);
      if (dayRes.status === 'fulfilled') {
        const data = dayRes.value.data.data || dayRes.value.data || [];
        setResults(data);
        setTotalHours(data.reduce((s: number, r: ResultItem) => s + (r.HOURS || 0), 0));
      }
      if (recentRes.status === 'fulfilled') {
        const raw = recentRes.value.data.data || recentRes.value.data || [];
        const seen = new Set<number>();
        const unique: RecentJob[] = [];
        for (const r of raw) {
          if (!r.JOB_UID || seen.has(r.JOB_UID)) continue;
          seen.add(r.JOB_UID);
          unique.push({
            JOB_UID: r.JOB_UID,
            JOB_NAME: r.JOB_NAME,
            JOB_TYPE_UID: r.JOB_TYPE_UID || 0,
            JOB_METHOD_UID: r.JOB_METHOD_UID || 0,
          });
          if (unique.length >= 4) break;
        }
        setRecentJobs(unique);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const calcEndTime = (start: string, hours: number) => {
    let sh: number, sm: number;
    if (start.includes(':')) {
      [sh, sm] = start.split(':').map(Number);
    } else {
      sh = Math.floor(Number(start) / 100);
      sm = Number(start) % 100;
    }
    const endMin = sh * 60 + sm + hours * 60;
    return `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  };

  const loadFormData = async () => {
    if (!user) return;
    const [jobRes, typeRes, methodRes] = await Promise.allSettled([
      jobApi.list({ emp_uid: user.emp_uid }),
      commonApi.jobTypes(),
      commonApi.jobMethods(),
    ]);
    if (jobRes.status === 'fulfilled') setJobs(jobRes.value.data.data || jobRes.value.data || []);
    if (typeRes.status === 'fulfilled') setJobTypes(typeRes.value.data.data || typeRes.value.data || []);
    if (methodRes.status === 'fulfilled') setJobMethods(methodRes.value.data.data || methodRes.value.data || []);
  };

  const openForm = async () => {
    if (!user) return;
    await loadFormData();
    setEditingUid(null);
    setJobSearch('');
    const defaultHours = 1;
    try {
      const res = await resultApi.lastEndTime(user.emp_uid, todayStr());
      const startTime = res.data?.last_end_time ? fmtTime(res.data.last_end_time) : '09:00';
      setForm({
        job_uid: 0, job_type_uid: 0, job_method_uid: 0,
        start_time: startTime, hours: defaultHours,
        end_time: calcEndTime(startTime, defaultHours),
        note: '',
      });
    } catch {
      setForm(f => ({ ...f, job_uid: 0, job_type_uid: 0, job_method_uid: 0, hours: defaultHours, end_time: calcEndTime(f.start_time, defaultHours), note: '' }));
    }
    setShowForm(true);
  };

  const handleEditCard = async (item: ResultItem) => {
    if (!user) return;
    await loadFormData();
    setEditingUid(item.REPORT_UID);
    setJobSearch('');
    setForm({
      job_uid: item.JOB_UID,
      job_type_uid: item.JOB_TYPE_UID || 0,
      job_method_uid: item.JOB_METHOD_UID || 0,
      start_time: fmtTime(item.START_TIME),
      end_time: fmtTime(item.END_TIME),
      hours: item.HOURS,
      note: item.NOTE || '',
    });
    setShowForm(true);
  };

  const handleQuickJob = (rj: RecentJob) => {
    setForm(f => ({
      ...f,
      job_uid: rj.JOB_UID,
      job_type_uid: rj.JOB_TYPE_UID || f.job_type_uid,
      job_method_uid: rj.JOB_METHOD_UID || f.job_method_uid,
    }));
  };

  const handleHoursChange = (hours: number) => {
    const endTime = calcEndTime(form.start_time, hours);
    setForm(f => ({ ...f, hours, end_time: endTime }));
  };

  const handleSave = async () => {
    if (!user || !form.job_uid || !form.job_type_uid || !form.job_method_uid) {
      alert('업무, 유형, 방법을 선택해주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        job_uid: form.job_uid,
        job_type_uid: form.job_type_uid,
        job_method_uid: form.job_method_uid,
        reg_date: todayStr(),
        start_time: form.start_time.replace(':', ''),
        end_time: form.end_time.replace(':', ''),
        hours: form.hours,
        note: form.note,
      };
      if (editingUid) {
        await resultApi.update({ report_uid: editingUid, ...payload });
      } else {
        await resultApi.save({ emp_uid: user.emp_uid, dept_uid: user.dept_uid, ...payload });
      }
      setShowForm(false);
      setEditingUid(null);
      setForm({ job_uid: 0, job_type_uid: 0, job_method_uid: 0, start_time: '09:00', end_time: '18:00', hours: 8, note: '' });
      fetchResults();
    } catch {
      alert(editingUid ? '수정 실패' : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uid: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('이 실적을 삭제하시겠어요?')) return;
    try {
      await resultApi.delete(uid);
      fetchResults();
    } catch {
      alert('삭제 실패');
    }
  };

  const closeWidget = () => {
    const w = window as unknown as { wtsElectron?: { hideWidget: () => void } };
    if (w.wtsElectron?.hideWidget) {
      w.wtsElectron.hideWidget();
    }
  };

  const selectedJob = jobs.find(j => j.JOB_UID === form.job_uid);
  const selectedScope = selectedJob?.JOB_SCOPE_CODE?.toUpperCase() || '';
  const scopeToTypeCodes: Record<string, string[]> = {
    MA: ['MA', 'SM', 'MD'], EB: ['EB', 'MD', 'EX'], EX: ['EX', 'MD'],
    PS: ['PS'], PT: ['RD'], SM: ['SM'], CO: ['CO'],
  };
  const allowedCodes = selectedScope ? (scopeToTypeCodes[selectedScope] || [selectedScope]) : [];
  const filteredJobTypes = selectedScope
    ? jobTypes.filter(t => { const code = t.JOB_TYPE_CODE.toUpperCase(); return allowedCodes.includes(code) || code === 'CO'; })
    : jobTypes;
  const groupedJobTypes = filteredJobTypes.reduce<Record<string, typeof filteredJobTypes>>((acc, t) => {
    const group = t.JOB_TYPE_DETAIL || t.JOB_TYPE_CODE;
    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  const searchedJobs = jobSearch.trim()
    ? jobs.filter(j => j.JOB_NAME.toLowerCase().includes(jobSearch.trim().toLowerCase()))
    : jobs;
  const QUICK_HOURS = [1, 2, 4, 8];

  const TARGET_HOURS = 8;
  const progressPercent = Math.min((totalHours / TARGET_HOURS) * 100, 100);

  if (!user) {
    return (
      <div className="widget-container">
        <div className="widget-header">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600">WTS</span>
            <button onClick={closeWidget} className="widget-btn-close" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl mb-3">&#128274;</div>
            <p className="text-sm text-gray-500">메인 창에서 로그인해주세요</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-container">
      {/* Header */}
      <div className="widget-header">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-blue-600 tracking-tight">WTS</span>
            <span className="text-xs text-gray-400">{todayLabel()}</span>
          </div>
          <div className="flex items-center gap-1">
            {!showForm && (
              <button
                onClick={openForm}
                className="widget-btn-action bg-blue-500 hover:bg-blue-600"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                title="실적 등록"
              >
                +
              </button>
            )}
            <button
              onClick={closeWidget}
              className="widget-btn-close"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              title="닫기"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: progressPercent >= 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums ${progressPercent >= 100 ? 'text-green-500' : 'text-blue-600'}`}>{totalHours}h</span>
        </div>
      </div>

      {/* Quick input form */}
      {showForm && (
        <div className="px-3 py-2.5 border-b border-blue-100 bg-blue-50/80">
          <div className="space-y-2">
            {editingUid && (
              <div className="text-[11px] text-blue-600 font-semibold">실적 수정</div>
            )}
            {!editingUid && recentJobs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recentJobs.map(rj => (
                  <button
                    key={rj.JOB_UID}
                    onClick={() => handleQuickJob(rj)}
                    className={`widget-chip ${form.job_uid === rj.JOB_UID ? 'widget-chip-active' : ''}`}
                    title={rj.JOB_NAME}
                  >
                    {rj.JOB_NAME.length > 10 ? rj.JOB_NAME.slice(0, 10) + '…' : rj.JOB_NAME}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={jobSearch}
              onChange={e => setJobSearch(e.target.value)}
              placeholder="업무 검색..."
              className="widget-input w-full"
            />
            <select value={form.job_uid} onChange={e => setForm(f => ({ ...f, job_uid: Number(e.target.value), job_type_uid: 0 }))} className="widget-input w-full" size={jobSearch.trim() ? Math.min(5, searchedJobs.length + 1) : 1}>
              <option value={0}>-- 업무 선택 --</option>
              {searchedJobs.map(j => <option key={j.JOB_UID} value={j.JOB_UID}>{j.JOB_NAME}</option>)}
            </select>
            <div className="flex gap-1.5">
              <select value={form.job_type_uid} onChange={e => setForm(f => ({ ...f, job_type_uid: Number(e.target.value) }))} className="widget-input flex-1">
                <option value={0}>유형</option>
                {Object.entries(groupedJobTypes).map(([group, types]) => (
                  <optgroup key={group} label={group}>
                    {types.map(t => <option key={t.JOB_TYPE_UID} value={t.JOB_TYPE_UID}>{t.JOB_TYPE}</option>)}
                  </optgroup>
                ))}
              </select>
              <select value={form.job_method_uid} onChange={e => setForm(f => ({ ...f, job_method_uid: Number(e.target.value) }))} className="widget-input flex-1">
                <option value={0}>방법</option>
                {jobMethods.map(m => <option key={m.JOB_METHOD_UID} value={m.JOB_METHOD_UID}>{m.JOB_METHOD}</option>)}
              </select>
            </div>
            <div className="flex gap-1 items-center flex-wrap">
              {QUICK_HOURS.map(h => (
                <button
                  key={h}
                  onClick={() => handleHoursChange(h)}
                  className={`widget-chip ${form.hours === h ? 'widget-chip-active' : ''}`}
                >
                  {h}h
                </button>
              ))}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <input type="number" step="0.5" min="0.5" value={form.hours} onChange={e => handleHoursChange(Number(e.target.value))} className="w-10 text-xs text-center border-none outline-none bg-transparent font-medium" />
                <span className="text-xs text-gray-400">h</span>
              </div>
              <span className="text-[11px] text-gray-400 ml-auto">{form.start_time} ~ {form.end_time}</span>
            </div>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="비고 (선택)" className="widget-input w-full" />
            <div className="flex justify-end gap-1.5 pt-0.5">
              <button onClick={() => { setShowForm(false); setEditingUid(null); }} className="widget-btn-text">취소</button>
              <button onClick={handleSave} disabled={saving} className="widget-btn-primary bg-blue-500 hover:bg-blue-600">
                {saving ? '저장 중...' : (editingUid ? '수정' : '저장')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="widget-body">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-xs text-gray-400">로딩 중...</div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="text-center">
              <div className="text-2xl mb-2 opacity-40">&#128203;</div>
              <p className="text-xs text-gray-400 mb-2">오늘 등록된 실적이 없습니다</p>
              {!showForm && (
                <button onClick={openForm} className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                  + 실적 등록하기
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-2 py-1.5 space-y-1">
            {results.map(r => (
              <div
                key={r.REPORT_UID}
                className="widget-card widget-card-clickable"
                onClick={() => handleEditCard(r)}
                title="클릭하여 수정"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-800 truncate leading-snug">{r.JOB_NAME}</div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">{fmtTime(r.START_TIME)} ~ {fmtTime(r.END_TIME)}</div>
                    {r.NOTE && <div className="text-[11px] text-gray-500 truncate mt-0.5">{r.NOTE}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-sm font-bold text-blue-600 tabular-nums">{r.HOURS}h</div>
                    <button
                      onClick={e => handleDelete(r.REPORT_UID, e)}
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors"
                      title="삭제"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="widget-footer">
        <span className="text-[11px] text-gray-400">{user.user_name}</span>
        <span className="text-[11px] text-gray-300 font-mono">Ctrl+Shift+D</span>
      </div>
    </div>
  );
}
