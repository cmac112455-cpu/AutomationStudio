import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  MessageSquare, 
  CheckSquare, 
  LogOut, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/copilot', label: 'AI Co-Pilot', icon: MessageSquare },
    { path: '/tasks', label: 'Task Planner', icon: CheckSquare },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 glass-morph border-r border-gray-800 p-6 flex flex-col" data-testid="sidebar">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#4785ff] flex items-center justify-center glow-effect">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#00d4ff] to-[#4785ff] bg-clip-text text-transparent">
              APOE
            </h1>
            <p className="text-xs text-gray-500">Business Co-Pilot</p>
          </div>
        </div>

        {/* Profile Incomplete Warning */}
        {!user?.profile_completed && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6" data-testid="profile-incomplete-banner">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-500 font-medium">Profile Incomplete</p>
                <p className="text-xs text-yellow-500/80 mt-1">Complete your profile to unlock all features</p>
                <Button
                  onClick={() => navigate('/onboarding')}
                  size="sm"
                  className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-black"
                  data-testid="complete-profile-button"
                >
                  Complete Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#00d4ff]/20 to-[#4785ff]/20 border-l-4 border-[#00d4ff] text-[#00d4ff]' 
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-gray-800 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-500">Business Owner</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
