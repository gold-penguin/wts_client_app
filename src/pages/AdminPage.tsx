import { useState, useEffect } from 'react';
import { adminApi } from '../api/admin';
import { getUser } from '../stores/authStore';

interface UserItem {
  EMP_UID: number;
  USERID: string;
  NAME: string;
  GRADE: string;
  DEPT_NAME: string;
  LEVEL_NAME: string;
  IS_ENABLE: number;
}

export default function AdminPage() {
  const user = getUser()!;
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'depts'>('users');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await adminApi.users(user.emp_uid);
        setUsers(res.data.data || res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    if (tab === 'users') fetchUsers();
  }, [tab, user.emp_uid]);

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">관리</h2>

      <div className="flex gap-1 mb-4 border-b">
        <button onClick={() => setTab('users')} className={`px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>사용자 관리</button>
        <button onClick={() => setTab('depts')} className={`px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'depts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>부서 관리</button>
      </div>

      {tab === 'users' && (
        loading ? (
          <div className="text-center py-12 text-gray-500">로딩 중...</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="table-wrap">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">아이디</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">직급</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">부서</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">권한</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.EMP_UID} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{u.USERID}</td>
                        <td className="px-4 py-3 font-medium">{u.NAME}</td>
                        <td className="px-4 py-3 text-gray-500">{u.GRADE || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{u.DEPT_NAME || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{u.LEVEL_NAME || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.IS_ENABLE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.IS_ENABLE ? '활성' : '비활성'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {users.map((u) => (
                <div key={u.EMP_UID} className="bg-white rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{u.NAME} <span className="text-gray-400 font-normal">({u.USERID})</span></div>
                      <div className="text-xs text-gray-500 mt-0.5">{u.DEPT_NAME || '-'} | {u.GRADE || '-'} | {u.LEVEL_NAME || '-'}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${u.IS_ENABLE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.IS_ENABLE ? '활성' : '비활성'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === 'depts' && (
        <div className="text-center py-12 text-gray-400">부서 관리 기능 준비 중</div>
      )}
    </div>
  );
}
