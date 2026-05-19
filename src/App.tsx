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
import { AuthProvider } from './components/AuthProvider';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inward" element={<InwardEntry />} />
            <Route path="/outward" element={<OutwardEntry />} />
            <Route path="/admin" element={<AdminSettings />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

