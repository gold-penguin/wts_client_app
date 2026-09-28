import { useEffect, useState } from 'react';
import { naverApi, naverAvailable, type NaverCalendar } from '../api/naverCalendar';
import { detachNaverItems, refreshNaverStatus, syncNaver, useNaverSyncState } from '../stores/naverSync';

const ago = (iso: string | null) => {
  if (!iso) return '아직 안 함';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
};

// '내 일정' 상단의 네이버 캘린더 연동 상태 + 설정
export default function NaverSyncBar({ empUid }: { empUid: number }) {
  const { status, running, lastSyncedAt, lastError } = useNaverSyncState();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { refreshNaverStatus(); }, []);

  if (!naverAvailable()) return null;

  const linked = !!status?.connected && status.empUid === empUid;
  const otherUser = !!status?.connected && status.empUid !== empUid;

  return (
    <>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="inline-flex items-center gap-1 font-semibold text-green-600">
          <span className="w-4 h-4 rounded bg-green-500 text-white text-[10px] font-black flex items-center justify-center">N</span>
          네이버 캘린더
        </span>
        {linked ? (
          <>
            <span className="text-gray-500 truncate max-w-[140px]" title={status?.calendarName || ''}>{status?.calendarName}</span>
            <span className={lastError ? 'text-red-500' : 'text-gray-400'} title={lastError || ''}>
              {running ? '동기화 중…' : lastError ? '동기화 실패' : ago(lastSyncedAt)}
            </span>
            <button
              onClick={() => { syncNaver(empUid).catch(() => {}); }}
              disabled={running}
              className="px-2 py-0.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              지금 동기화
            </button>
          </>
        ) : (
          <span className="text-gray-400">{otherUser ? '다른 WTS 사용자에 연결됨' : '연결 안 됨'}</span>
        )}
        <button onClick={() => setShowSettings(true)} className="px-2 py-0.5 rounded-lg text-blue-500 hover:bg-blue-50">
          {linked ? '설정' : '연결하기'}
        </button>
      </div>
      {lastError && linked && !running && (
        <p className="text-[11px] text-red-400 mt-1 text-right">{lastError}</p>
      )}
      {showSettings && <NaverSettingsModal empUid={empUid} onClose={() => setShowSettings(false)} />}
    </>
  );
}

function NaverSettingsModal({ empUid, onClose }: { empUid: number; onClose: () => void }) {
  const { status } = useNaverSyncState();
  const [username, setUsername] = useState(status?.username || '');
  const [password, setPassword] = useState('');
  const [calendars, setCalendars] = useState<NaverCalendar[] | null>(null);
  const [selectedUrl, setSelectedUrl] = useState(status?.calendarUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const hasSavedLogin = !!status?.username;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('아이디와 비밀번호를 입력하세요.'); return; }
    run(async () => {
      const list = await naverApi.connect(username.trim(), password);
      setPassword('');
      setCalendars(list);
      if (!list.some(c => c.url === selectedUrl)) setSelectedUrl(list[0]?.url || '');
      await refreshNaverStatus();
    });
  };

  const handleLoadCalendars = () => run(async () => {
    const list = await naverApi.listCalendars();
    setCalendars(list);
    if (!list.some(c => c.url === selectedUrl)) setSelectedUrl(list[0]?.url || '');
  });

  const handleSave = () => run(async () => {
    const cal = calendars?.find(c => c.url === selectedUrl);
    if (!cal) throw new Error('동기화할 캘린더를 선택하세요.');
    // 다른 캘린더(또는 다른 WTS 사용자)로 바꾸면 이전 캘린더에서 온 일정은 정리
    if (status?.calendarUrl && (status.calendarUrl !== cal.url || status.empUid !== empUid)) detachNaverItems(empUid);
    await naverApi.selectCalendar(cal.url, cal.name, empUid);
    await refreshNaverStatus();
    onClose();
    syncNaver(empUid).catch(() => {});
  });

  const handleDisconnect = () => run(async () => {
    await naverApi.disconnect();
    detachNaverItems(empUid);
    await refreshNaverStatus();
    onClose();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-700">네이버 캘린더 연동</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">닫기</button>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1 leading-relaxed">
          <p>'내 일정'의 <b>일정</b>이 선택한 네이버 캘린더와 양방향으로 동기화돼요. 할 일은 이 PC에만 남아요.</p>
          <p>2단계 인증을 쓰면 네이버 [내정보 → 보안설정 → 2단계 인증 → 애플리케이션 비밀번호]에서 만든 비밀번호를 입력하세요.</p>
          <p>비밀번호는 Windows 암호화로 이 PC에만 저장되고 WTS 서버로는 보내지 않아요.</p>
        </div>

        {/* 1. 로그인 */}
        <form onSubmit={handleConnect} className="space-y-2">
          <div className="text-sm font-semibold text-gray-600">1. 네이버 계정</div>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="네이버 아이디"
            autoComplete="off"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={hasSavedLogin ? '비밀번호 (변경할 때만 입력)' : '비밀번호 또는 애플리케이션 비밀번호'}
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="flex justify-end gap-2">
            {hasSavedLogin && !calendars && (
              <button type="button" onClick={handleLoadCalendars} disabled={busy} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                저장된 계정으로 캘린더 불러오기
              </button>
            )}
            <button type="submit" disabled={busy} className="px-4 py-1.5 text-xs bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50">
              {busy && !calendars ? '확인 중…' : '로그인 확인'}
            </button>
          </div>
        </form>

        {/* 2. 캘린더 선택 */}
        {calendars && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-600">2. 동기화할 캘린더</div>
            {calendars.length === 0 ? (
              <p className="text-xs text-gray-400">일정을 담을 수 있는 캘린더가 없습니다.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {calendars.map(c => (
                  <label key={c.url} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="radio" name="naver-cal" checked={selectedUrl === c.url} onChange={() => setSelectedUrl(c.url)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={busy || !selectedUrl} className="px-4 py-1.5 text-xs bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50">
                저장하고 동기화
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {hasSavedLogin && (
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {status?.connected ? `${status.username} · ${status.calendarName}` : `${status?.username} (캘린더 미선택)`}
            </span>
            {confirmDisconnect ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">네이버에서 가져온 일정은 앱에서 지워져요(네이버엔 그대로). 해제할까요?</span>
                <button onClick={handleDisconnect} disabled={busy} className="text-xs text-red-500 font-semibold hover:underline">해제</button>
                <button onClick={() => setConfirmDisconnect(false)} className="text-xs text-gray-400 hover:underline">취소</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDisconnect(true)} className="text-xs text-red-400 hover:text-red-600">연결 해제</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
