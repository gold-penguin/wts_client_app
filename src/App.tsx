import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn } from './stores/authStore';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import ResultPage from './pages/ResultPage';
import JobPage from './pages/JobPage';
import WeeklyPage from './pages/WeeklyPage';
import CustomerPage from './pages/CustomerPage';
import TeamPage from './pages/TeamPage';
import AdminPage from './pages/AdminPage';
import WidgetPage from './pages/WidgetPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/widget" element={<WidgetPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ResultPage />} />
          <Route path="jobs" element={<JobPage />} />
          <Route path="weekly" element={<WeeklyPage />} />
          <Route path="customers" element={<CustomerPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
