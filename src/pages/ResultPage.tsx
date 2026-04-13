import { useState, useEffect, useCallback } from 'react';
import { resultApi } from '../api/result';
import { jobApi } from '../api/job';
import { commonApi } from '../api/common';
import { customerApi } from '../api/customer';
import { aiApi } from '../api/ai';
import { getUser } from '../stores/authStore';

interface ResultItem {
  REPORT_UID: number;
  JOB_NAME: string;
  JOB_UID: number;
  REG_DATE: string;
  START_TIME: string;
  END_TIME: string;
  HOURS: number;
  NOTE: string;
  JOB_TYPE?: string;
  JOB_METHOD?: string;
  JOB_TYPE_UID?: number;
  JOB_METHOD_UID?: number;
  JOB_SCOPE_CODE?: string;
  CUSTOMER_NAME?: string;
  SITE_NAME?: string;
  EX_SITE_NAME?: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (s: string) => {
  if (!s || s.length < 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

const shortDate = (s: string) => {
  if (!s || s.length < 8) return s;
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
};

const dayLabel = (s: string) => {
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
};

// "0900" → "09:00", "09:00" → "09:00"
const fmtTime = (t: string) => {
  if (!t) return t;
  const clean = t.replace(':', '');
  if (clean.length >= 4) return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
  return t;
};

const scopeColors: Record<string, string> = {
  MA: 'bg-green-50 text-green-600 border-green-200',
  EB: 'bg-orange-50 text-orange-600 border-orange-200',
  EX: 'bg-orange-50 text-orange-600 border-orange-200',
  RD: 'bg-gray-50 text-gray-600 border-gray-200',
  PT: 'bg-gray-50 text-gray-600 border-gray-200',
  PS: 'bg-blue-50 text-blue-600 border-blue-200',
  CO: 'bg-purple-50 text-purple-600 border-purple-200',
  MD: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  SM: 'bg-teal-50 text-teal-600 border-teal-200',
};

export default function ResultPage() {
  const user = getUser()!;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [recentResults, setRecentResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editUid, setEditUid] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Array<{ JOB_UID: number; JOB_NAME: string; JOB_SCOPE_CODE: string }>>([]);
  const [jobTypes, setJobTypes] = useState<Array<{ JOB_TYPE_UID: number; JOB_TYPE: string; JOB_TYPE_CODE: string; JOB_TYPE_DETAIL: string | null }>>([]);
  const [jobMethods, setJobMethods] = useState<Array<{ JOB_METHOD_UID: number; JOB_METHOD: string }>>([]);
  const [form, setForm] = useState({
    job_uid: 0,
    job_type_uid: 0,
    job_method_uid: 1,
    start_time: '09:00',
    end_time: '18:00',
    hours: 1,
    note: '',
    is_outing: false,
  });

  // AI natural language input
  const [aiText, setAiText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');

  const handleOpenAiInput = () => {
    if (!aiApi.hasApiKey()) {
      setShowApiKeyInput(true);
    } else {
      setShowAiInput(v => !v);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyDraft.trim()) return;
    aiApi.setApiKey(apiKeyDraft.trim());
    setShowApiKeyInput(false);
    setApiKeyDraft('');
    setShowAiInput(true);
  };

  // Job creation inline
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobScopes, setJobScopes] = useState<Array<{ JOB_SCOPE_CODE: string; JOB_SCOPE_NAME: string }>>([]);
  const [customers, setCustomers] = useState<Array<{ CUSTOMER_UID: number; CUSTOMER_NAME: string }>>([]);
  const [jobSaving, setJobSaving] = useState(false);
  const [jobForm, setJobForm] = useState({
    job_name: '',
    job_scope_code: '',
    customer_uid: null as number | null,
    note: '',
  });

  const fetchDayResults = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, recentRes] = await Promise.all([
        resultApi.day(user.emp_uid, selectedDate),
        resultApi.recent(user.emp_uid, 10),
      ]);
      const dayData = dayRes.data.data || dayRes.data || [];
      const recentData = recentRes.data.data || recentRes.data || [];
      setResults(dayData);
      setTotalHours(dayData.reduce((sum: number, r: ResultItem) => sum + (r.HOURS || 0), 0));
      setRecentResults(recentData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.emp_uid, selectedDate]);

  useEffect(() => { fetchDayResults(); }, [fetchDayResults]);

  const loadFormData = async () => {
    const [jobRes, typeRes, methodRes] = await Promise.allSettled([
      jobApi.list({ emp_uid: user.emp_uid }),
      commonApi.jobTypes(),
      commonApi.jobMethods(),
    ]);
    if (jobRes.status === 'fulfilled') setJobs(jobRes.value.data.data || jobRes.value.data || []);
    if (typeRes.status === 'fulfilled') setJobTypes(typeRes.value.data.data || typeRes.value.data || []);
    if (methodRes.status === 'fulfilled') setJobMethods(methodRes.value.data.data || methodRes.value.data || []);
  };

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

  const handleNew = async () => {
    await loadFormData();
    const defaultHours = 1;
    let startTime = '09:00';
    try {
      const res = await resultApi.lastEndTime(user.emp_uid, selectedDate);
      if (res.data?.last_end_time) startTime = fmtTime(res.data.last_end_time);
    } catch { /* use default */ }
    setForm({
      job_uid: 0, job_type_uid: 0, job_method_uid: 1,
      start_time: startTime, end_time: calcEndTime(startTime, defaultHours),
      hours: defaultHours, note: '', is_outing: false,
    });
    setEditMode(false);
    setEditUid(null);
    setShowForm(true);
  };

  const handleEdit = async (item: ResultItem) => {
    await loadFormData();
    const outingMethodUid = jobMethods.find(m => m.JOB_METHOD === '외근')?.JOB_METHOD_UID;
    setForm({
      job_uid: item.JOB_UID,
      job_type_uid: item.JOB_TYPE_UID || 0,
      job_method_uid: item.JOB_METHOD_UID || 1,
      start_time: fmtTime(item.START_TIME),
      end_time: fmtTime(item.END_TIME),
      hours: item.HOURS,
      note: item.NOTE || '',
      is_outing: item.JOB_METHOD_UID === outingMethodUid,
    });
    setEditMode(true);
    setEditUid(item.REPORT_UID);
    setShowForm(true);
  };

  const handleCopyRecent = async (item: ResultItem) => {
    await loadFormData();
    let startTime = '09:00';
    try {
      const res = await resultApi.lastEndTime(user.emp_uid, selectedDate);
      if (res.data?.last_end_time) startTime = fmtTime(res.data.last_end_time);
    } catch { /* use default */ }
    const duration = item.HOURS || 1;
    const outingMethodUid = jobMethods.find(m => m.JOB_METHOD === '외근')?.JOB_METHOD_UID;
    setForm({
      job_uid: item.JOB_UID,
      job_type_uid: item.JOB_TYPE_UID || 0,
      job_method_uid: item.JOB_METHOD_UID || 1,
      start_time: startTime,
      end_time: calcEndTime(startTime, duration),
      hours: duration,
      note: '',
      is_outing: item.JOB_METHOD_UID === outingMethodUid,
    });
    setEditMode(false);
    setEditUid(null);
    setShowForm(true);
  };

  const handleOpenJobForm = async () => {
    try {
      const [scopeRes, custRes] = await Promise.all([commonApi.jobScopes(), customerApi.list()]);
      setJobScopes(scopeRes.data.data || scopeRes.data || []);
      setCustomers(custRes.data.data || custRes.data || []);
    } catch (err) { console.error(err); }
    setJobForm({ job_name: '', job_scope_code: '', customer_uid: null, note: '' });
    setShowJobForm(true);
  };

  const handleSaveJob = async () => {
    if (!jobForm.job_name.trim() || !jobForm.job_scope_code) {
      alert('업무명과 업무구분을 입력해주세요.');
      return;
    }
    setJobSaving(true);
    try {
      const res = await jobApi.create({
        job_name: jobForm.job_name.trim(),
        job_scope_code: jobForm.job_scope_code,
        customer_uid: jobForm.customer_uid,
        note: jobForm.note || null,
        charge_emp_uids: [user.emp_uid],
        main_emp_uid: user.emp_uid,
        dept_uids: [user.dept_uid],
      });
      setShowJobForm(false);
      const jobRes = await jobApi.list({ emp_uid: user.emp_uid });
      const newJobs = jobRes.data.data || jobRes.data || [];
      setJobs(newJobs);
      const newJobUid = res.data?.job_uid || res.data?.data?.job_uid || res.data?.JOB_UID;
      if (newJobUid) setForm(f => ({ ...f, job_uid: newJobUid }));
    } catch (err) {
      console.error(err);
      alert('업무 등록에 실패했습니다.');
    } finally {
      setJobSaving(false);
    }
  };

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setAiParsing(true);
    try {
      const [jobRes, typeRes, methodRes] = await Promise.all([
        jobApi.list({ emp_uid: user.emp_uid }), commonApi.jobTypes(), commonApi.jobMethods(),
      ]);
      const currentJobs = jobRes.data.data || jobRes.data || [];
      const currentTypes = typeRes.data.data || typeRes.data || [];
      const currentMethods = methodRes.data.data || methodRes.data || [];
      setJobs(currentJobs); setJobTypes(currentTypes); setJobMethods(currentMethods);

      const res = await aiApi.parseWork({
        text: aiText.trim(), jobs: currentJobs, job_types: currentTypes, job_methods: currentMethods,
      });
      const parsed = res.data;

      let startTime = form.start_time;
      try {
        const lastRes = await resultApi.lastEndTime(user.emp_uid, selectedDate);
        if (lastRes.data?.last_end_time) startTime = lastRes.data.last_end_time;
      } catch { /* use default */ }

      const hours = parsed.hours || 1;
      const outingMethodUid = currentMethods.find((m: { JOB_METHOD: string }) => m.JOB_METHOD === '외근')?.JOB_METHOD_UID;
      setForm(f => ({
        ...f,
        job_uid: parsed.job_uid || f.job_uid,
        job_type_uid: parsed.job_type_uid || f.job_type_uid,
        job_method_uid: parsed.job_method_uid || f.job_method_uid,
        hours, start_time: startTime, end_time: calcEndTime(startTime, hours),
        note: parsed.note || f.note,
        is_outing: parsed.job_method_uid === outingMethodUid,
      }));
      setShowAiInput(false); setShowForm(true); setEditMode(false); setEditUid(null); setAiText('');
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
    if (!form.job_uid || !form.job_type_uid) {
      alert('업무와 업무유형을 선택해주세요.');
      return;
    }
    // Determine method uid from is_outing checkbox
    const outingMethod = jobMethods.find(m => m.JOB_METHOD === '외근');
    const normalMethod = jobMethods.find(m => m.JOB_METHOD === '일반');
    const methodUid = form.is_outing ? (outingMethod?.JOB_METHOD_UID || 2) : (normalMethod?.JOB_METHOD_UID || 1);

    // 서버는 "0900" 형식 기대
    const sendTime = (t: string) => t.replace(':', '');
    try {
      if (editMode && editUid) {
        await resultApi.update({
          report_uid: editUid, job_uid: form.job_uid, job_type_uid: form.job_type_uid,
          job_method_uid: methodUid, reg_date: selectedDate,
          start_time: sendTime(form.start_time), end_time: sendTime(form.end_time), hours: form.hours, note: form.note,
        });
      } else {
        await resultApi.save({
          emp_uid: user.emp_uid, dept_uid: user.dept_uid,
          job_uid: form.job_uid, job_type_uid: form.job_type_uid,
          job_method_uid: methodUid, reg_date: selectedDate,
          start_time: sendTime(form.start_time), end_time: sendTime(form.end_time), hours: form.hours, note: form.note,
        });
      }
      setShowForm(false);
      fetchDayResults();
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (report_uid: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try { await resultApi.delete(report_uid); fetchDayResults(); } catch (err) { console.error(err); }
  };

  const changeDate = (delta: number) => {
    const y = Number(selectedDate.slice(0, 4));
    const m = Number(selectedDate.slice(4, 6)) - 1;
    const d = Number(selectedDate.slice(6, 8));
    const next = new Date(y, m, d + delta);
    setSelectedDate(
      `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`
    );
  };

  const isToday = selectedDate === todayStr();

  // 선택된 업무의 scope code
  const selectedJob = jobs.find(j => j.JOB_UID === form.job_uid);
  const selectedScope = selectedJob?.JOB_SCOPE_CODE?.toUpperCase() || '';

  // scope → 허용되는 type code 매핑 (scope명에 괄호 안에 있는 코드들)
  const scopeToTypeCodes: Record<string, string[]> = {
    MA: ['MA', 'SM', 'MD'],
    EB: ['EB', 'MD', 'EX'],
    EX: ['EX', 'MD'],
    PS: ['PS'],
    PT: ['RD'],
    SM: ['SM'],
    CO: ['CO'],
  };

  // 업무 scope에 맞는 유형만 필터 + CO(공통)도 포함
  const allowedCodes = selectedScope ? (scopeToTypeCodes[selectedScope] || [selectedScope]) : [];
  const filteredJobTypes = selectedScope
    ? jobTypes.filter(t => {
        const code = t.JOB_TYPE_CODE.toUpperCase();
        return allowedCodes.includes(code) || code === 'CO';
      })
    : jobTypes;

  // optgroup으로 그룹핑
  const groupedJobTypes = filteredJobTypes.reduce<Record<string, typeof filteredJobTypes>>((acc, t) => {
    const group = t.JOB_TYPE_DETAIL || t.JOB_TYPE_CODE;
    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  // 업무 드롭다운에 [SCOPE] prefix 추가
  const jobLabel = (j: { JOB_NAME: string; JOB_SCOPE_CODE: string }) =>
    `[${j.JOB_SCOPE_CODE.toUpperCase()}] ${j.JOB_NAME}`;

  // 히스토리에서 사이트 정보
  const siteLabel = (r: ResultItem) => {
    if (r.CUSTOMER_NAME && r.SITE_NAME) return `[${r.CUSTOMER_NAME}/${r.SITE_NAME}]`;
    if (r.CUSTOMER_NAME) return `[${r.CUSTOMER_NAME}]`;
    if (r.EX_SITE_NAME) return `[${r.EX_SITE_NAME}]`;
    if (r.SITE_NAME) return `[${r.SITE_NAME}]`;
    return '';
  };

  return (
    <div className="flex-1 min-w-0">
      {/* Date nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h2 className="text-base sm:text-lg font-bold text-gray-700 whitespace-nowrap">
            {formatDate(selectedDate)} ({dayLabel(selectedDate)})
            {isToday && <span className="ml-1.5 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">오늘</span>}
          </h2>
          <button onClick={() => changeDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(todayStr())} className="text-xs text-blue-500 hover:underline ml-1 shrink-0">오늘</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">합계: <strong className="text-gray-700">{totalHours}h</strong></span>
          <button onClick={handleOpenAiInput} className="px-3 py-1.5 border border-purple-200 text-purple-500 rounded-lg text-sm font-medium hover:bg-purple-50 shrink-0 transition-colors">AI 입력</button>
          <button onClick={handleNew} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 shrink-0 transition-colors">+ 실적 등록</button>
        </div>
      </div>

      {/* API Key input */}
      {showApiKeyInput && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 mb-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Google Gemini API 키 설정</h3>
          <p className="text-xs text-yellow-600 mb-3">AI 기능을 사용하려면 Gemini API 키가 필요합니다. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google AI Studio</a>에서 무료로 발급받을 수 있습니다.</p>
          <div className="flex gap-2">
            <input type="password" value={apiKeyDraft} onChange={e => setApiKeyDraft(e.target.value)} placeholder="AIza..." className="flex-1 border border-yellow-200 rounded px-3 py-1.5 text-sm" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(); }} />
            <button onClick={() => setShowApiKeyInput(false)} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={handleSaveApiKey} disabled={!apiKeyDraft.trim()} className="px-4 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50">저장</button>
          </div>
        </div>
      )}

      {/* AI natural language input */}
      {showAiInput && !showForm && (
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 mb-4">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">AI 업무 입력</h3>
          <p className="text-xs text-purple-600 mb-3">자연어로 업무를 입력하면 자동으로 분석하여 폼을 채워드립니다.</p>
          <textarea value={aiText} onChange={e => setAiText(e.target.value)} placeholder={"예: WTS 프로젝트 프론트엔드 개발 3시간, 현장 방문\n예: 모컴시스 서버 유지보수 2시간 원격으로 진행"} className="w-full border border-purple-200 rounded px-3 py-2 text-sm resize-none" rows={3} autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiParse(); } }} />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setShowAiInput(false); setAiText(''); }} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={handleAiParse} disabled={aiParsing || !aiText.trim()} className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50">{aiParsing ? '분석 중...' : '분석하기'}</button>
          </div>
        </div>
      )}

      {/* Results list */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">로딩 중...</div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 sm:py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-base sm:text-lg mb-2">등록된 실적이 없습니다</p>
          <p className="text-xs sm:text-sm">"실적 등록" 버튼을 눌러 업무를 기록하세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.REPORT_UID} className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 hover:shadow-sm transition-all group">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.JOB_SCOPE_CODE && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${scopeColors[r.JOB_SCOPE_CODE.toUpperCase()] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {r.JOB_SCOPE_CODE.toUpperCase()}
                      </span>
                    )}
                    <span className="font-medium text-gray-700 text-sm sm:text-base truncate">{r.JOB_NAME}</span>
                  </div>
                  {r.NOTE && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{r.NOTE}</p>}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs sm:text-sm text-gray-500">{fmtTime(r.START_TIME)} ~ {fmtTime(r.END_TIME)}</div>
                    <div className="text-sm font-semibold text-blue-600">{r.HOURS}h</div>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(r)} className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-1">수정</button>
                    <button onClick={() => handleDelete(r.REPORT_UID)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1">삭제</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Modal Form ===== */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowForm(false); setEditMode(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex" onClick={e => e.stopPropagation()}>
            {/* Left: Recent history */}
            <div className="w-80 border-r border-gray-100 bg-gray-50 flex flex-col shrink-0 hidden md:flex">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-700">최근 입력 히스토리</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {recentResults.map((r, i) => (
                  <button
                    key={`h-${r.REPORT_UID}-${i}`}
                    onClick={() => handleCopyRecent(r)}
                    className="w-full text-left rounded-lg border bg-white p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${scopeColors[r.JOB_SCOPE_CODE?.toUpperCase() || ''] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {r.JOB_SCOPE_CODE?.toUpperCase() || '?'}
                      </span>
                      <span className="text-xs text-gray-400">{shortDate(r.REG_DATE)} ({r.HOURS}h)</span>
                    </div>
                    {siteLabel(r) && (
                      <div className="text-xs text-gray-400 mb-0.5">{siteLabel(r)}</div>
                    )}
                    <div className="text-xs font-medium text-gray-800 line-clamp-2">{r.JOB_NAME}</div>
                    {r.NOTE && <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{r.NOTE}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Form */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-700">{editMode ? '실적 수정' : '실적 입력'}</h2>
                <button onClick={() => { setShowForm(false); setEditMode(false); }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Start time info */}
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-500">
                  시작시간: <strong className="text-gray-700">{form.start_time}</strong> (이전 실적 종료 기준)
                </div>

                {/* 업무 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5"><span className="text-red-400">*</span> 업무</label>
                  <div className="flex gap-2">
                    <select
                      value={form.job_uid}
                      onChange={e => setForm(f => ({ ...f, job_uid: Number(e.target.value), job_type_uid: 0 }))}
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    >
                      <option value={0}>-- 업무 선택 --</option>
                      {jobs.map(j => <option key={j.JOB_UID} value={j.JOB_UID}>{jobLabel(j)}</option>)}
                    </select>
                    <button type="button" onClick={handleOpenJobForm} className="px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-50 shrink-0 whitespace-nowrap transition-colors">
                      + 신규 업무
                    </button>
                  </div>

                  {/* Inline job creation */}
                  {showJobForm && (
                    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-blue-800">새 업무 등록</span>
                        <button onClick={() => setShowJobForm(false)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <input type="text" value={jobForm.job_name} onChange={e => setJobForm(f => ({ ...f, job_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="업무명 *" autoFocus />
                        </div>
                        <select value={jobForm.job_scope_code} onChange={e => setJobForm(f => ({ ...f, job_scope_code: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                          <option value="">-- 업무구분 * --</option>
                          {jobScopes.map(s => <option key={s.JOB_SCOPE_CODE} value={s.JOB_SCOPE_CODE}>{s.JOB_SCOPE_NAME || s.JOB_SCOPE_CODE}</option>)}
                        </select>
                        <select value={jobForm.customer_uid ?? ''} onChange={e => setJobForm(f => ({ ...f, customer_uid: e.target.value ? Number(e.target.value) : null }))} className="border rounded-lg px-3 py-2 text-sm">
                          <option value="">고객사 (선택)</option>
                          {customers.map(c => <option key={c.CUSTOMER_UID} value={c.CUSTOMER_UID}>{c.CUSTOMER_NAME}</option>)}
                        </select>
                        <div className="col-span-2">
                          <input type="text" value={jobForm.note} onChange={e => setJobForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="비고 (선택)" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <button onClick={() => setShowJobForm(false)} className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-white">취소</button>
                        <button onClick={handleSaveJob} disabled={jobSaving} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">{jobSaving ? '등록 중...' : '업무 등록'}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 업무유형 + 외근 체크 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5"><span className="text-red-400">*</span> 업무유형</label>
                  <div className="flex items-center gap-4">
                    <select
                      value={form.job_type_uid}
                      onChange={e => setForm(f => ({ ...f, job_type_uid: Number(e.target.value) }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    >
                      <option value={0}>카테고리 &gt; 유형 선택</option>
                      {Object.entries(groupedJobTypes).map(([group, types]) => (
                        <optgroup key={group} label={group}>
                          {types.map(t => <option key={t.JOB_TYPE_UID} value={t.JOB_TYPE_UID}>{t.JOB_TYPE}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.is_outing}
                        onChange={e => setForm(f => ({ ...f, is_outing: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">외근 (현장지원/출장/외부업무)</span>
                    </label>
                  </div>
                </div>

                {/* 업무시간 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5"><span className="text-red-400">*</span> 업무시간</label>
                  <select
                    value={form.hours}
                    onChange={e => handleHoursChange(Number(e.target.value))}
                    className="w-40 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{h}시간</option>
                    ))}
                  </select>
                </div>

                {/* 비고 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">비고</label>
                  <textarea
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-y min-h-[100px] focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    placeholder="작업 내용을 입력하세요"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <button onClick={handleSave} className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
                  {editMode ? '수정' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
