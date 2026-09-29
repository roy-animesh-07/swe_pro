import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { Spinner } from './components/common.jsx';
import LoginPage from './pages/LoginPage.jsx';
import UsersPage from './pages/registrar/UsersPage.jsx';
import NewCasePage from './pages/registrar/NewCasePage.jsx';
import ManageCasePage, { OpenCasePage } from './pages/registrar/ManageCasePage.jsx';
import { PendingCasesPage, ResolvedCasesPage, HearingsByDatePage, CaseStatusPage } from './pages/registrar/QueryPages.jsx';
import { PastCaseSearchPage, PastCaseViewPage } from './pages/pastcases/PastCasePages.jsx';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute roles={['REGISTRAR']} />}>
        <Route element={<Layout />}>
          <Route path="/registrar/users" element={<UsersPage />} />
          <Route path="/registrar/cases/new" element={<NewCasePage />} />
          <Route path="/registrar/cases" element={<OpenCasePage />} />
          <Route path="/registrar/cases/:cin" element={<ManageCasePage />} />
          <Route path="/registrar/queries/pending" element={<PendingCasesPage />} />
          <Route path="/registrar/queries/resolved" element={<ResolvedCasesPage />} />
          <Route path="/registrar/queries/hearings" element={<HearingsByDatePage />} />
          <Route path="/registrar/queries/status" element={<CaseStatusPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['JUDGE']} />}>
        <Route element={<Layout />}>
          <Route path="/judge/past-cases" element={<PastCaseSearchPage />} />
          <Route path="/judge/past-cases/:cin" element={<PastCaseViewPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['LAWYER']} />}>
        <Route element={<Layout />}>
          <Route path="/lawyer/past-cases" element={<PastCaseSearchPage />} />
          <Route path="/lawyer/past-cases/:cin" element={<PastCaseViewPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
