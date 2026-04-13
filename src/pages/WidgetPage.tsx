import { useState, useEffect, useCallback } from 'react';
import { resultApi } from '../api/result';
import { jobApi } from '../api/job';
import { commonApi } from '../api/common';
import { aiApi } from '../api/ai';
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
  const [jobs, setJobs] = useState<Array<{ JOB_UID: number; JOB_NAME: string; JOB_SCOPE_CODE: string }>>([]);
  const [jobTypes, setJobTypes] = useState<Array<{ JOB_TYPE_UID: number; JOB_TYPE: string; JOB_TYPE_CODE: string; JOB_TYPE_DETAIL: string | null }>>([]);
  const [jobMethods, setJobMethods] = useState<Array<{ JOB_METHOD_UID: number; JOB_METHOD: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');

  const handleOpenAiInput = () => {
    if (!aiApi.hasApiKey()) {
      setShowApiKeyInput(true);
    } else {
      setShowAiInput(true);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyDraft.trim()) return;
    aiApi.setApiKey(apiKeyDraft.trim());
    setShowApiKeyInput(false);
    setApiKeyDraft('');
    setShowAiInput(true);
  };

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
      const res = await resultApi.day(user.emp_uid, todayStr());
      const data = res.data.data || res.data || [];
      setResults(data);
      setTotalHours(data.reduce((s: number, r: ResultItem) => s + (r.HOURS || 0), 0));
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

  const openForm = async () => {
    if (!user) return;
    const [jobRes, typeRes, methodRes] = await Promise.allSettled([
      jobApi.list({ emp_uid: user.emp_uid }),
      commonApi.jobTypes(),
      commonApi.jobMethods(),
    ]);
    if (jobRes.status === 'fulfilled') setJobs(jobRes.value.data.data || jobRes.value.data || []);
    if (typeRes.status === 'fulfilled') setJobTypes(typeRes.value.data.data || typeRes.value.data || []);
    if (methodRes.status === 'fulfilled') setJobMethods(methodRes.value.data.data || methodRes.value.data || []);
    const defaultHours = 1;
    try {
      const res = await resultApi.lastEndTime(user.emp_uid, todayStr());
      if (res.data?.last_end_time) {
        const startTime = res.data.last_end_time;
        setForm(f => ({ ...f, start_time: startTime, hours: defaultHours, end_time: calcEndTime(startTime, defaultHours) }));
      } else {
        setForm(f => ({ ...f, hours: defaultHours, end_time: calcEndTime(f.start_time, defaultHours) }));
      }
    } catch {
      setForm(f => ({ ...f, hours: defaultHours, end_time: calcEndTime(f.start_time, defaultHours) }));
    }
    setShowForm(true);
  };

  const handleAiParse = async () => {
    if (!user || !aiText.trim()) return;
    setAiParsing(true);
    try {
      const [jobRes, typeRes, methodRes] = await Promise.all([
        jobApi.list({ emp_uid: user.emp_uid }),
        commonApi.jobTypes(),
        commonApi.jobMethods(),
      ]);
      const currentJobs = jobRes.data.data || jobRes.data || [];
      const currentTypes = typeRes.data.data || typeRes.data || [];
      const currentMethods = methodRes.data.data || methodRes.data || [];
      setJobs(currentJobs);
      setJobTypes(currentTypes);
      setJobMethods(currentMethods);

      const res = await aiApi.parseWork({
        text: aiText.trim(),
        jobs: currentJobs,
        job_types: currentTypes,
        job_methods: currentMethods,
      });
      const parsed = res.data;

      let startTime = form.start_time;
      try {
        const lastRes = await resultApi.lastEndTime(user.emp_uid, todayStr());
        if (lastRes.data?.last_end_time) startTime = lastRes.data.last_end_time;
      } catch { /* use default */ }

      const hours = parsed.hours || 1;
      const endTime = calcEndTime(startTime, hours);

      setForm(f => ({
        ...f,
        job_uid: parsed.job_uid || f.job_uid,
        job_type_uid: parsed.job_type_uid || f.job_type_uid,
        job_method_uid: parsed.job_method_uid || f.job_method_uid,
        hours,
        start_time: startTime,
        end_time: endTime,
        note: parsed.note || f.note,
      }));

      setShowAiInput(false);
      setShowForm(true);
      setAiText('');
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`AI 분석 실패: ${msg}`);
    } finally {
      setAiParsing(false);
    }
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
      await resultApi.save({
        emp_uid: user.emp_uid,
        dept_uid: user.dept_uid,
        job_uid: form.job_uid,
        job_type_uid: form.job_type_uid,
        job_method_uid: form.job_method_uid,
        reg_date: todayStr(),
        start_time: form.start_time.replace(':', ''),
        end_time: form.end_time.replace(':', ''),
        hours: form.hours,
        note: form.note,
      });
      setShowForm(false);
      setForm({ job_uid: 0, job_type_uid: 0, job_method_uid: 0, start_time: '09:00', end_time: '18:00', hours: 8, note: '' });
      fetchResults();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uid: number) => {
    try {
      await resultApi.delete(uid);
      fetchResults();
    } catch { /* ignore */ }
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
            {!showForm && !showAiInput && (
              <>
                <button
                  onClick={handleOpenAiInput}
                  className="widget-btn-action bg-purple-500 hover:bg-purple-600"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  title="AI 입력"
                >
                  AI
                </button>
                <button
                  onClick={openForm}
                  className="widget-btn-action bg-blue-500 hover:bg-blue-600"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  title="실적 등록"
                >
                  +
                </button>
              </>
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

      {/* API Key input */}
      {showApiKeyInput && (
        <div className="px-3 py-2.5 border-b border-amber-100 bg-amber-50/80">
          <p className="text-xs text-amber-700 mb-2">Gemini API 키 입력 (<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">무료 발급</a>)</p>
          <div className="flex gap-1.5">
            <input
              type="password"
              value={apiKeyDraft}
              onChange={e => setApiKeyDraft(e.target.value)}
              placeholder="AIza..."
              className="widget-input flex-1"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(); }}
            />
            <button onClick={() => setShowApiKeyInput(false)} className="widget-btn-text">취소</button>
            <button onClick={handleSaveApiKey} disabled={!apiKeyDraft.trim()} className="widget-btn-primary bg-amber-500 hover:bg-amber-600">저장</button>
          </div>
        </div>
      )}

      {/* AI natural language input */}
      {showAiInput && !showForm && (
        <div className="px-3 py-2.5 border-b border-purple-100 bg-purple-50/80">
          <textarea
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            placeholder='예: "WTS 개발 3시간 원격"'
            className="widget-input w-full resize-none mb-2"
            rows={2}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAiParse();
              }
            }}
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setShowAiInput(false); setAiText(''); }} className="widget-btn-text">취소</button>
            <button
              onClick={handleAiParse}
              disabled={aiParsing || !aiText.trim()}
              className="widget-btn-primary bg-purple-500 hover:bg-purple-600"
            >
              {aiParsing ? '분석 중...' : '분석'}
            </button>
          </div>
        </div>
      )}

      {/* Quick input form */}
      {showForm && (
        <div className="px-3 py-2.5 border-b border-blue-100 bg-blue-50/80">
          <div className="space-y-2">
            <select value={form.job_uid} onChange={e => setForm(f => ({ ...f, job_uid: Number(e.target.value), job_type_uid: 0 }))} className="widget-input w-full">
              <option value={0}>-- 업무 선택 --</option>
              {jobs.map(j => <option key={j.JOB_UID} value={j.JOB_UID}>{j.JOB_NAME}</option>)}
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
            <div className="flex gap-1.5 items-center">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <input type="number" step="1" min="1" value={form.hours} onChange={e => handleHoursChange(Number(e.target.value))} className="w-10 text-xs text-center border-none outline-none bg-transparent font-medium" />
                <span className="text-xs text-gray-400">시간</span>
              </div>
              <span className="text-xs text-gray-400 ml-1">{form.start_time} ~ {form.end_time}</span>
            </div>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="비고 (선택)" className="widget-input w-full" />
            <div className="flex justify-end gap-1.5 pt-0.5">
              <button onClick={() => setShowForm(false)} className="widget-btn-text">취소</button>
              <button onClick={handleSave} disabled={saving} className="widget-btn-primary bg-blue-500 hover:bg-blue-600">
                {saving ? '저장 중...' : '저장'}
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
              <div key={r.REPORT_UID} className="group widget-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-800 truncate leading-snug">{r.JOB_NAME}</div>
                    {r.NOTE && <div className="text-[11px] text-gray-400 truncate mt-0.5">{r.NOTE}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] text-gray-400 leading-tight">{r.START_TIME}~{r.END_TIME}</div>
                      <div className="text-xs font-bold text-blue-600 leading-tight">{r.HOURS}h</div>
                    </div>
                    <button
                      onClick={() => handleDelete(r.REPORT_UID)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-0.5 -mr-0.5"
                      title="삭제"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
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
