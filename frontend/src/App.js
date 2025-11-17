import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';

import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import CoPilotPage from './pages/CoPilotPage';
import TasksPage from './pages/TasksPage';
import AutomationStudioPage from './pages/AutomationStudioPage';
import IntegrationsPage from './pages/IntegrationsPage';
import CompletionsPage from './pages/CompletionsPage';
import Layout from './components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.baseURL = API;

export const AuthContext = React.createContext();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('apoe_token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (newToken, userData) => {
    localStorage.setItem('apoe_token', newToken);
    setToken(newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('apoe_token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  if (loading) {
    return (
      <div className="min-h-screen apoe-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#00d4ff] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#00d4ff] font-semibold">Loading APOE...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      <BrowserRouter>
        <div className="App apoe-gradient min-h-screen">
          <Routes>
            <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to={user.profile_completed ? "/dashboard" : "/onboarding"} />} />
            <Route path="/onboarding" element={user ? <OnboardingPage /> : <Navigate to="/auth" />} />
            <Route
              path="/*"
              element={
                user ? (
                  user.profile_completed ? (
                    <Layout>
                      <Routes>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/copilot" element={<CoPilotPage />} />
                        <Route path="/tasks" element={<TasksPage />} />
                        <Route path="/automation/studio" element={<AutomationStudioPage />} />
                        <Route path="/automation/completions" element={<CompletionsPage />} />
                        <Route path="/automation" element={<Navigate to="/automation/studio" />} />
                        <Route path="/" element={<Navigate to="/dashboard" />} />
                      </Routes>
                    </Layout>
                  ) : (
                    <Navigate to="/onboarding" />
                  )
                ) : (
                  <Navigate to="/auth" />
                )
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
