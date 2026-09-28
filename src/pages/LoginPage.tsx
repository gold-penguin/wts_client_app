import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAutoLogin, setAutoLogin, getOfflineProfile, setUser } from '../stores/authStore';
import { isConnectionError } from '../api/client';
import { useConnection } from '../stores/connectionStore';
import { naverApi, naverAvailable } from '../api/naverCalendar';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLoginState] = useState(getAutoLogin);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { serverDown } = useConnection();
  const [connFailed, setConnFailed] = useState(false);
  // 네이버 연동 설정(메인 프로세스 파일)에 저장된 사번 — 이 창의 저장소가 비어 있어도 오프라인 시작 가능
  const [naverEmpUid, setNaverEmpUid] = useState<number | null>(null);
  useEffect(() => {
    if (!naverAvailable()) return;
    naverApi.status().then(s => setNaverEmpUid(s.empUid)).catch(() => {});
  }, []);
  const offlineProfile = (serverDown || connFailed) ? getOfflineProfile(naverEmpUid) : null;

  // 서버 없이 이 PC의 데이터('내 일정')만 쓰도록 시작. 서버가 돌아오면 첫 요청에서 다시 로그인 화면으로 안내된다.
  const startOffline = () => {
    if (!offlineProfile) return;
    setUser(offlineProfile);
    navigate('/planner');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (autoLogin) {
        setAutoLogin(true, { user_id: userId, password });
      } else {
        setAutoLogin(false);
      }
      await login(userId, password);
    } catch (err) {
      setConnFailed(isConnectionError(err));
      setError(isConnectionError(err)
        ? 'WTS 서버에 연결할 수 없습니다. 네트워크나 서버 상태를 확인해 주세요.'
        : '아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm px-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-blue-500 mb-1">WTS</h1>
            <p className="text-sm text-gray-400">Work Tracking System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-600 mb-1">
                아이디
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                placeholder="아이디를 입력하세요"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoLogin}
                onChange={(e) => setAutoLoginState(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-300"
              />
              <span className="text-sm text-gray-500">자동 로그인</span>
            </label>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {offlineProfile && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-center space-y-2">
              <button
                type="button"
                onClick={startOffline}
                className="w-full py-2.5 px-4 border border-orange-200 text-orange-600 bg-orange-50 rounded-lg font-medium hover:bg-orange-100 transition-colors"
              >
                오프라인으로 시작
              </button>
              <p className="text-xs text-gray-400">
                서버 없이 이 PC에 저장된 '내 일정'을 쓸 수 있어요.
                {offlineProfile.user_name && offlineProfile.dept_name && ` (${offlineProfile.dept_name} ${offlineProfile.user_name})`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
