/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { InwardEntry } from './pages/InwardEntry';
import { OutwardEntry } from './pages/OutwardEntry';
import { AdminSettings } from './pages/AdminSettings';
import { TaskPlanner } from './pages/TaskPlanner';
import { NoteBook } from './pages/NoteBook';
import { BvpScrapPosition } from './pages/BvpScrapPosition';
import { TotalScrapPosition } from './pages/TotalScrapPosition';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { SyncStatus } from './components/SyncStatus';

function AppContent() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inward" element={<InwardEntry />} />
          <Route path="/outward" element={<OutwardEntry />} />
          <Route path="/total-scrap" element={<TotalScrapPosition />} />
          <Route path="/bvp-scrap" element={<BvpScrapPosition />} />
          <Route path="/admin" element={<AdminSettings />} />
          <Route path="/tasks" element={<TaskPlanner />} />
          <Route path="/notebook" element={<NoteBook />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SyncStatus />
      <AppContent />
    </AuthProvider>
  );
}
