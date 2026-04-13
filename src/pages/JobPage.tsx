import { useState, useEffect } from 'react';
import { jobApi } from '../api/job';

interface JobItem {
  JOB_UID: number;
  JOB_NAME: string;
  JOB_SCOPE_CODE: string;
  STATUS: number;
  STATUS_NAME?: string;
  CUSTOMER_NAME?: string;
  MAIN_EMP_NAME?: string;
  EXPECTED_START_DATE?: string;
  EXPECTED_END_DATE?: string;
}

export default function JobPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await jobApi.list({ keyword: keyword || undefined, status: statusFilter });
      setJobs(res.data.data || res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchJobs(); };

  const statusBadge = (status: number, name?: string) => {
    const colors: Record<number, string> = {
      0: 'bg-gray-100 text-gray-600',
      1: 'bg-blue-50 text-blue-600',
      2: 'bg-green-50 text-green-600',
      3: 'bg-red-50 text-red-600',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{name || `상태${status}`}</span>;
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-4 sm:mb-6">📋 업무 관리</h2>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="업무명 검색" className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button type="submit" className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 shrink-0 transition-colors">검색</button>
        </form>
        <select value={statusFilter ?? ''} onChange={e => setStatusFilter(e.target.value ? Number(e.target.value) : undefined)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">전체 상태</option>
          <option value="0">대기</option>
          <option value="1">진행중</option>
          <option value="2">완료</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">업무가 없습니다.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">업무명</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">구분</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">상태</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">고객사</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">담당자</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">예상 기간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {jobs.map((j) => (
                    <tr key={j.JOB_UID} className="hover:bg-blue-50/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-700 truncate max-w-[300px]">{j.JOB_NAME}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{j.JOB_SCOPE_CODE}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusBadge(j.STATUS, j.STATUS_NAME)}</td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-[150px]">{j.CUSTOMER_NAME || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{j.MAIN_EMP_NAME || '-'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {j.EXPECTED_START_DATE && j.EXPECTED_END_DATE ? `${j.EXPECTED_START_DATE} ~ ${j.EXPECTED_END_DATE}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {jobs.map((j) => (
              <div key={j.JOB_UID} className="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-gray-700 truncate">{j.JOB_NAME}</div>
                    <div className="text-xs text-gray-400 mt-1">{j.CUSTOMER_NAME || '-'} | {j.MAIN_EMP_NAME || '-'}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {statusBadge(j.STATUS, j.STATUS_NAME)}
                    <span className="text-xs text-gray-400">{j.JOB_SCOPE_CODE}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
