import { useEffect, useState } from 'react';

type UpdaterStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; version?: string }
  | { type: 'up-to-date'; version?: string }
  | { type: 'downloading'; percent?: number }
  | { type: 'downloaded'; version?: string }
  | { type: 'error'; message?: string };

interface UpdaterApi {
  check: () => void;
  install: () => void;
  getStatus: () => Promise<UpdaterStatus>;
  onStatus: (cb: (s: UpdaterStatus) => void) => () => void;
}

interface WtsElectron {
  getAppVersion?: () => Promise<string>;
  updater?: UpdaterApi;
}

const getApi = (): WtsElectron | undefined => {
  return (window as unknown as { wtsElectron?: WtsElectron }).wtsElectron;
};

export default function UpdateStatus() {
  const api = getApi();
  const [version, setVersion] = useState<string>('');
  const [status, setStatus] = useState<UpdaterStatus>({ type: 'idle' });

  useEffect(() => {
    if (!api) return;
    api.getAppVersion?.().then(setVersion).catch(() => {});
    api.updater?.getStatus().then(setStatus).catch(() => {});
    const off = api.updater?.onStatus(setStatus);
    return () => { off?.(); };
  }, [api]);

  if (!api?.updater) return null;

  const label = (() => {
    switch (status.type) {
      case 'checking': return '확인 중…';
      case 'downloading': return `다운로드 ${Math.round(status.percent ?? 0)}%`;
      case 'available': return `v${status.version} 받는 중…`;
      case 'downloaded': return '재시작 필요';
      case 'error': return '업데이트 오류';
      case 'up-to-date':
      case 'idle':
      default: return version ? `v${version}` : '';
    }
  })();

  const color = (() => {
    switch (status.type) {
      case 'downloaded': return 'text-green-600 hover:text-green-700';
      case 'error': return 'text-red-500 hover:text-red-600';
      case 'checking':
      case 'downloading':
      case 'available': return 'text-blue-500 hover:text-blue-600';
      default: return 'text-gray-400 hover:text-gray-600';
    }
  })();

  const handleClick = () => {
    if (status.type === 'downloaded') {
      api.updater?.install();
    } else {
      api.updater?.check();
    }
  };

  const title = status.type === 'downloaded'
    ? '클릭하여 재시작 및 설치'
    : '클릭하여 업데이트 확인';

  return (
    <button
      onClick={handleClick}
      title={title}
      className={`text-xs px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors tabular-nums ${color}`}
    >
      {label}
    </button>
  );
}
