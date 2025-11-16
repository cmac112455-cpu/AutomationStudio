import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  PhoneCall, 
  Calendar,
  Instagram,
  Twitter,
  Mail,
  Activity,
  Lock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00d4ff] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const latestFinancial = dashboardData?.financial?.[0] || {};
  const totalRevenue = dashboardData?.financial?.reduce((sum, item) => sum + item.revenue, 0) || 0;
  const totalExpenses = dashboardData?.financial?.reduce((sum, item) => sum + item.expenses, 0) || 0;
  const avgProfitMargin = dashboardData?.financial?.reduce((sum, item) => sum + item.profit_margin, 0) / (dashboardData?.financial?.length || 1) || 0;

  const COLORS = ['#00d4ff', '#4785ff', '#00ff88', '#ffc107'];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Business Dashboard</h1>
        <p className="text-gray-400">Real-time overview of your business operations</p>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card rounded-xl p-6 card-hover" data-testid="revenue-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
              <h3 className="text-3xl font-bold">${totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+12.5% from last period</span>
          </div>
        </div>

        <div className="stat-card rounded-xl p-6 card-hover" data-testid="expenses-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Expenses</p>
              <h3 className="text-3xl font-bold">${totalExpenses.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <TrendingDown className="w-4 h-4" />
            <span>-3.2% from last period</span>
          </div>
        </div>

        <div className="stat-card rounded-xl p-6 card-hover" data-testid="profit-margin-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Avg Profit Margin</p>
              <h3 className="text-3xl font-bold">{avgProfitMargin.toFixed(1)}%</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#00d4ff]/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-[#00d4ff]" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#00d4ff] text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>Healthy margin</span>
          </div>
        </div>

        <div className="stat-card rounded-xl p-6 card-hover" data-testid="calls-bookings-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Calls & Bookings</p>
              <h3 className="text-3xl font-bold">{latestFinancial.calls_count + latestFinancial.bookings_count}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <PhoneCall className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-purple-500 text-sm">
            <Calendar className="w-4 h-4" />
            <span>{latestFinancial.calls_count} calls, {latestFinancial.bookings_count} bookings</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Expenses Trend */}
        <div className="glass-morph rounded-xl p-6" data-testid="revenue-expenses-chart">
          <h3 className="text-xl font-semibold mb-4">Revenue vs Expenses Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dashboardData?.financial?.reverse() || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={3} dot={{ fill: '#00d4ff', r: 5 }} />
              <Line type="monotone" dataKey="expenses" stroke="#ff4d4d" strokeWidth={3} dot={{ fill: '#ff4d4d', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Margin Trend */}
        <div className="glass-morph rounded-xl p-6" data-testid="profit-margin-chart">
          <h3 className="text-xl font-semibold mb-4">Profit Margin Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboardData?.financial || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="profit_margin" fill="#00ff88" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ad Campaigns & Communication Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ad Campaigns */}
        <div className="lg:col-span-2 glass-morph rounded-xl p-6" data-testid="ad-campaigns-section">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Meta Ad Campaigns</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Lock className="w-4 h-4" />
              <span>Simulated Data</span>
            </div>
          </div>
          <div className="space-y-4">
            {dashboardData?.ad_campaigns?.map((campaign, index) => (
              <div key={campaign.id} className="glass-morph p-4 rounded-lg" data-testid={`campaign-${index}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{campaign.campaign_name}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      campaign.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{campaign.roas.toFixed(1)}x</p>
                    <p className="text-xs text-gray-400">ROAS</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">CTR</p>
                    <p className="font-semibold text-[#00d4ff]">{campaign.ctr}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400">CPC</p>
                    <p className="font-semibold text-[#4785ff]">${campaign.cpc}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Spend</p>
                    <p className="font-semibold text-yellow-500">${campaign.spend}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Conv.</p>
                    <p className="font-semibold text-green-500">{campaign.conversions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Communication Feeds */}
        <div className="glass-morph rounded-xl p-6" data-testid="communication-feeds-section">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Today's Activity</h3>
            <Activity className="w-5 h-5 text-[#00d4ff]" />
          </div>
          <div className="space-y-4">
            <div className="glass-morph p-4 rounded-lg flex items-center justify-between" data-testid="instagram-feed">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">Instagram DMs</p>
                  <p className="text-xs text-gray-400">New messages</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#00d4ff]">{dashboardData?.communication_feeds?.instagram_dm_count || 0}</p>
            </div>

            <div className="glass-morph p-4 rounded-lg flex items-center justify-between" data-testid="twitter-feed">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <Twitter className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">Twitter Mentions</p>
                  <p className="text-xs text-gray-400">Brand mentions</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#4785ff]">{dashboardData?.communication_feeds?.twitter_mention_count || 0}</p>
            </div>

            <div className="glass-morph p-4 rounded-lg flex items-center justify-between" data-testid="email-feed">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">Emails</p>
                  <p className="text-xs text-gray-400">New inquiries</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#00ff88]">{dashboardData?.communication_feeds?.email_count || 0}</p>
            </div>

            <div className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg p-3 mt-4">
              <p className="text-xs text-[#00d4ff]">
                <Lock className="w-3 h-3 inline mr-1" />
                Connect real accounts in settings to view live data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
