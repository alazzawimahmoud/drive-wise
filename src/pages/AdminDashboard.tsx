import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';
import {
  Users,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  LogOut,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface UserProgress {
  id: number;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  preferredLocale: string;
  preferredRegion: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  progress: {
    totalSessions: number;
    passedSessions: number;
    passRate: number;
    averageScore: number;
    averagePercentage: number;
    totalQuestionsAnswered: number;
    totalCorrect: number;
    overallAccuracy: number;
    lastExamDate: Date | null;
    recentSessions: Array<{
      id: number;
      score: number;
      percentage: number;
      passed: boolean;
      totalQuestions: number;
      completedAt: Date;
    }>;
  };
}

interface UsersResponse {
  users: UserProgress[];
  totalUsers: number;
  usersWithProgress: number;
}

interface PlatformStats {
  totalUsers: number;
  usersWithExams: number;
  totalExams: number;
  passedExams: number;
  overallPassRate: number;
  averageScore: number;
  averagePercentage: number;
  overallAccuracy: number;
}

export const AdminDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'sessions' | 'passRate'>('created');

  const { data: usersData, isLoading: isUsersLoading } = useQuery<UsersResponse>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data;
    },
  });

  const { data: platformStats, isLoading: isStatsLoading } = useQuery<PlatformStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data;
    },
  });

  if (isUsersLoading || isStatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Filter and sort users
  const filteredUsers = (usersData?.users || [])
    .filter((u) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        u.displayName.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        false
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'sessions':
          return b.progress.totalSessions - a.progress.totalSessions;
        case 'passRate':
          return b.progress.passRate - a.progress.passRate;
        default:
          return 0;
      }
    });

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-black text-indigo-600 tracking-tight">DriveWise</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase">Admin Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold"
          >
            <Users size={20} /> Users
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/dashboard');
            }}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <BarChart3 size={20} /> User Dashboard
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="px-4 py-2 text-xs text-slate-500 mb-2">
            <p className="font-bold">Logged in as:</p>
            <p className="truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-500 hover:text-rose-600 transition-colors font-medium"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h2>
          <p className="text-slate-500">Manage users and monitor platform statistics</p>
        </header>

        {/* Platform Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Total Users</p>
                <p className="text-2xl font-black text-slate-900">
                  {platformStats?.totalUsers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Target size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Active Users</p>
                <p className="text-2xl font-black text-slate-900">
                  {platformStats?.usersWithExams || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Overall Pass Rate</p>
                <p className="text-2xl font-black text-slate-900">
                  {platformStats?.overallPassRate || 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Total Exams</p>
                <p className="text-2xl font-black text-slate-900">
                  {platformStats?.totalExams || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-slate-900">
                Registered Users ({filteredUsers.length})
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as 'name' | 'created' | 'sessions' | 'passRate'
                    )
                  }
                  className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="created">Sort by: Newest</option>
                  <option value="name">Sort by: Name</option>
                  <option value="sessions">Sort by: Sessions</option>
                  <option value="passRate">Sort by: Pass Rate</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Sessions
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Pass Rate
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Avg Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Last Exam
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((userData) => (
                    <tr key={userData.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {userData.avatarUrl ? (
                            <img
                              src={userData.avatarUrl}
                              alt={userData.displayName}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-indigo-600 font-bold text-sm">
                                {userData.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{userData.displayName}</p>
                            <p className="text-xs text-slate-500">{userData.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(userData.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(userData.lastLoginAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">
                          {userData.progress.totalSessions}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {userData.progress.totalSessions > 0 ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                'text-sm font-bold',
                                userData.progress.passRate >= 80
                                  ? 'text-emerald-600'
                                  : userData.progress.passRate >= 60
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              )}
                            >
                              {userData.progress.passRate}%
                            </span>
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={clsx(
                                  'h-full transition-all',
                                  userData.progress.passRate >= 80
                                    ? 'bg-emerald-500'
                                    : userData.progress.passRate >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                )}
                                style={{ width: `${userData.progress.passRate}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No exams</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {userData.progress.totalSessions > 0 ? (
                          <span className="text-sm font-bold text-slate-900">
                            {userData.progress.averageScore}/50
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {userData.progress.lastExamDate
                          ? formatDate(userData.progress.lastExamDate)
                          : 'Never'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Sessions for Selected User (expandable) */}
          {filteredUsers.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <details className="group">
                <summary className="cursor-pointer text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors">
                  View Recent Exam Sessions
                </summary>
                <div className="mt-4 space-y-4">
                  {filteredUsers
                    .filter((u) => u.progress.recentSessions.length > 0)
                    .slice(0, 5)
                    .map((userData) => (
                      <div key={userData.id} className="bg-white p-4 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                          {userData.avatarUrl ? (
                            <img
                              src={userData.avatarUrl}
                              alt={userData.displayName}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-indigo-600 font-bold text-xs">
                                {userData.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {userData.displayName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {userData.progress.recentSessions.length} recent session(s)
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                          {userData.progress.recentSessions.map((session) => (
                            <div
                              key={session.id}
                              className={clsx(
                                'p-3 rounded-lg border text-center',
                                session.passed
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : 'bg-rose-50 border-rose-200'
                              )}
                            >
                              <div className="flex items-center justify-center gap-1 mb-1">
                                {session.passed ? (
                                  <CheckCircle2 size={14} className="text-emerald-600" />
                                ) : (
                                  <XCircle size={14} className="text-rose-600" />
                                )}
                                <span
                                  className={clsx(
                                    'text-xs font-bold',
                                    session.passed ? 'text-emerald-700' : 'text-rose-700'
                                  )}
                                >
                                  {session.passed ? 'Passed' : 'Failed'}
                                </span>
                              </div>
                              <p className="text-xs font-black text-slate-900">
                                {session.score}/50
                              </p>
                              <p className="text-xs text-slate-600">{session.percentage}%</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {formatDate(session.completedAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

