import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getUser, clearUser } from '../stores/authStore';

const navItems = [
  { to: '/', label: '실적 입력', icon: '✏️' },
  { to: '/jobs', label: '업무 관리', icon: '📋' },
  { to: '/weekly', label: '주간 보고', icon: '📊' },
  { to: '/customers', label: '고객사', icon: '🏢' },
  { to: '/team', label: '팀 현황', icon: '👥' },
];

export default function MainLayout() {
  const user = getUser();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearUser();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-blue-50 text-blue-600'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="px-3 sm:px-4 flex items-center justify-between h-12 sm:h-14">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-blue-500 shrink-0">WTS</h1>

            {/* Desktop nav */}
            <nav className="hidden md:flex gap-0.5">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.to === '/'}>
                  <span className="mr-1 text-xs">{item.icon}</span>{item.label}
                </NavLink>
              ))}
              {user && user.work_level >= 4 && (
                <NavLink to="/admin" className={navLinkClass}>
                  <span className="mr-1 text-xs">⚙️</span>관리
                </NavLink>
              )}
            </nav>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-50 text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <>
                <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline truncate max-w-[180px]">
                  {user.dept_name} {user.user_name}{user.grade ? ` ${user.grade}` : ''}
                </span>
                <span className="text-xs text-gray-400 sm:hidden truncate max-w-[100px]">
                  {user.user_name}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs sm:text-sm text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 shrink-0 transition-colors"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-3 py-2 flex flex-col gap-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navLinkClass}
                end={item.to === '/'}
                onClick={() => setMenuOpen(false)}
              >
                <span className="mr-1 text-xs">{item.icon}</span>{item.label}
              </NavLink>
            ))}
            {user && user.work_level >= 4 && (
              <NavLink to="/admin" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <span className="mr-1 text-xs">⚙️</span>관리
              </NavLink>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
