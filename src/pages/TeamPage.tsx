import { useState, useEffect } from 'react';
import { resultApi } from '../api/result';
import { deptApi } from '../api/dept';
import { getUser } from '../stores/authStore';

interface TeamMember { EMP_UID: number; NAME: string; DEPT_NAME: string; }
interface TeamResult { EMP_UID: number; NAME: string; DEPT_NAME: string; REG_DATE: string; total_hours: number; }

export default function TeamPage() {
  const user = getUser()!;
  const today = new Date();
  const [month, setMonth] = useState(() => `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [results, setResults] = useState<TeamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      try {
        const teamRes = await deptApi.myTeam(user.emp_uid, user.dept_uid, user.work_level);
        const teamMembers = teamRes.data.data || teamRes.data || [];
        setMembers(teamMembers);
        if (teamMembers.length > 0) {
          const empUids = teamMembers.map((m: TeamMember) => m.EMP_UID).join(',');
          const resultRes = await resultApi.teamMonthly(empUids, month);
          setResults(resultRes.data.data || resultRes.data || []);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchTeam();
  }, [month, user.emp_uid, user.dept_uid, user.work_level]);

  const memberHours = members.map(m => {
    const hrs = results.filter(r => r.EMP_UID === m.EMP_UID).reduce((sum, r) => sum + (r.total_hours || 0), 0);
    return { ...m, totalHours: hrs };
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-700">👥 팀 현황</h2>
        <input type="month" value={`${month.slice(0,4)}-${month.slice(4,6)}`} onChange={e => setMonth(e.target.value.replace('-', ''))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-gray-400">팀원 정보가 없습니다.</div>
      ) : (
        <div className="space-y-2 sm:space-y-0">
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">부서</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">월 누적 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {memberHours.map((m) => (
                  <tr key={m.EMP_UID} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-700">{m.NAME}</td>
                    <td className="px-4 py-3 text-gray-500">{m.DEPT_NAME}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[200px] bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-400 rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (m.totalHours / 160) * 100)}%` }} />
                        </div>
                        <span className="text-blue-600 text-sm font-bold shrink-0 w-12 text-right">{m.totalHours}h</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {memberHours.map((m) => (
              <div key={m.EMP_UID} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm text-gray-700">{m.NAME}</div>
                    <div className="text-xs text-gray-400">{m.DEPT_NAME}</div>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{m.totalHours}h</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-400 rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (m.totalHours / 160) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
