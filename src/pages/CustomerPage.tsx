import { useState, useEffect } from 'react';
import { customerApi } from '../api/customer';

interface SiteItem {
  SITE_UID: number;
  SITE_NAME: string;
  CUSTOMER_NAME: string;
  SITE_STATE_NAME?: string;
  MA_START_DATE?: string;
  MA_END_DATE?: string;
  CONTRACT_COUNT?: number;
}

export default function CustomerPage() {
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  const fetchSites = async () => {
    setLoading(true);
    try {
      const res = await customerApi.sites({ keyword: keyword || undefined });
      setSites(res.data.data || res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSites(); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchSites(); };

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-4 sm:mb-6">🏢 고객사 관리</h2>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="고객사 / 사이트 검색" className="flex-1 min-w-0 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <button type="submit" className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 shrink-0 transition-colors">검색</button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">사이트가 없습니다.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">사이트명</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">고객사</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">상태</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">MA 기간</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-16">계약</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sites.map((s) => (
                    <tr key={s.SITE_UID} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-700 truncate max-w-[200px]">{s.SITE_NAME}</td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-[150px]">{s.CUSTOMER_NAME}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{s.SITE_STATE_NAME || '-'}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{s.MA_START_DATE && s.MA_END_DATE ? `${s.MA_START_DATE} ~ ${s.MA_END_DATE}` : '-'}</td>
                      <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">{s.CONTRACT_COUNT ?? 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {sites.map((s) => (
              <div key={s.SITE_UID} className="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-gray-700 truncate">{s.SITE_NAME}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.CUSTOMER_NAME}</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 shrink-0">{s.SITE_STATE_NAME || '-'}</span>
                </div>
                {s.MA_START_DATE && s.MA_END_DATE && (
                  <div className="text-xs text-gray-400 mt-1.5">MA: {s.MA_START_DATE} ~ {s.MA_END_DATE}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
