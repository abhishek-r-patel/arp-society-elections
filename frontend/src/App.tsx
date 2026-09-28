// Route map: voter flow (/, /vote, /receipt), public /results, and the
// separate admin flow (/admin login, /admin/dashboard, /admin/setup-election).
// Voter-flow state (code, positions, ballot receipt) is passed page-to-page
// via router location state, not a global store — see each page's
// `location.state` read.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VoterLoginPage from './pages/VoterLoginPage';
import VoterBallotPage from './pages/VoterBallotPage';
import VoterReceiptPage from './pages/VoterReceiptPage';
import RegisterPage from './pages/RegisterPage';
import ResultsPage from './pages/ResultsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminSetupElectionPage from './pages/AdminSetupElectionPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VoterLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/vote" element={<VoterBallotPage />} />
        <Route path="/receipt" element={<VoterReceiptPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/setup-election" element={<AdminSetupElectionPage />} />
      </Routes>
    </BrowserRouter>
  );
}
