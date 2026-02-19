import { Routes, Route, Link } from 'react-router-dom';
import { Server, Play, History, Info, Activity } from 'lucide-react';
import ServerPage from './pages/ServerPage';
import ClientPage from './pages/ClientPage';
import HistoryPage from './pages/HistoryPage';
import AboutPage from './pages/AboutPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">OB-UDPST Control Panel</h1>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <NavLink to="/server" icon={<Server size={20} />}>
                  Server
                </NavLink>
                <NavLink to="/client" icon={<Play size={20} />}>
                  Client Test
                </NavLink>
                <NavLink to="/history" icon={<History size={20} />}>
                  History
                </NavLink>
                <NavLink to="/diagnostics" icon={<Activity size={20} />}>
                  Diagnostics
                </NavLink>
                <NavLink to="/about" icon={<Info size={20} />}>
                  About
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<ClientPage />} />
          <Route path="/server" element={<ServerPage />} />
          <Route path="/client" element={<ClientPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  );
}

function NavLink({ to, icon, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
    >
      <span className="mr-2">{icon}</span>
      {children}
    </Link>
  );
}

export default App;
