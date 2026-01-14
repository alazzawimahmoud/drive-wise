import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { useState } from 'react';
import { 
  Trophy, 
  Target, 
  Flame, 
  BookOpen, 
  LogOut,
  AlertCircle,
  ClipboardCheck,
  RotateCcw,
  X,
  AlertTriangle
} from 'lucide-react';

interface Stats {
  totalSessions: number;
  passRate: number;
  averageScore: number;
  licenseProbability: number;
  currentStreak: number;
  improvement: number | null;
}

interface CategoryStat {
  slug: string;
  title: string;
  accuracy: number;
  totalAnswered: number;
}

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/stats/reset-exam-scores');
      return res.data;
    },
    onSuccess: () => {
      // Invalidate all stats queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      queryClient.invalidateQueries({ queryKey: ['stats-categories'] });
      queryClient.invalidateQueries({ queryKey: ['exam-history'] });
      setShowResetModal(false);
      setConfirmText('');
    },
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery<Stats>({
    queryKey: ['stats-overview'],
    queryFn: async () => {
      const res = await api.get('/stats/overview');
      return res.data;
    },
  });

  const { data: categoryData } = useQuery<{ categories: CategoryStat[] }>({
    queryKey: ['stats-categories'],
    queryFn: async () => {
      const res = await api.get('/stats/categories');
      return res.data;
    },
  });

  if (isStatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const licenseProb = stats?.licenseProbability || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-black text-indigo-600 tracking-tight">DriveWise</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold"
          >
            <Target size={20} /> Dashboard
          </button>
          <button 
            onClick={() => navigate('/lessons')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <BookOpen size={20} /> Study
          </button>
          <button 
            onClick={() => navigate('/exam')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <ClipboardCheck size={20} /> Exam
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button 
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-500 hover:text-amber-600 transition-colors font-medium"
          >
            <RotateCcw size={20} /> Reset Exam Scores
          </button>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-500 hover:text-rose-600 transition-colors font-medium"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.displayName}
                className="w-16 h-16 rounded-full border-2 border-indigo-100 shadow-sm object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-indigo-100 shadow-sm flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user?.displayName}!</h2>
              <p className="text-slate-500">Keep practicing!</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => navigate('/lessons')}
              className="bg-white hover:bg-slate-50 text-indigo-600 px-6 py-3 rounded-2xl font-bold border-2 border-indigo-200 transition-all transform hover:scale-105"
            >
              <BookOpen size={18} className="inline mr-2" />
              Study
            </button>
            <button 
              onClick={() => navigate('/exam')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all transform hover:scale-105"
            >
              <ClipboardCheck size={18} className="inline mr-2" />
              Exam
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-6">License Probability</h3>
            <div className="relative w-48 h-48 mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-100"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={552.92}
                  strokeDashoffset={552.92 * (1 - licenseProb / 100)}
                  className={clsx(
                    "transition-all duration-1000",
                    licenseProb >= 80 ? "text-emerald-500" : licenseProb >= 60 ? "text-amber-500" : "text-rose-500"
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-900">{licenseProb}%</span>
                <span className="text-xs font-bold text-slate-400 uppercase">Ready</span>
              </div>
            </div>
            <p className="text-slate-600 text-sm font-medium">
              {licenseProb >= 80 ? "High probability of passing!" : licenseProb >= 60 ? "You're getting close!" : "Keep practicing!"}
            </p>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Target size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Pass Rate</p>
                <p className="text-2xl font-black text-slate-900">{stats?.passRate}%</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Average Score</p>
                <p className="text-2xl font-black text-slate-900">{stats?.averageScore}/50</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <Flame size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Streak</p>
                <p className="text-2xl font-black text-slate-900">{stats?.currentStreak} Exams</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Weak Areas</p>
                <p className="text-2xl font-black text-slate-900">
                  {categoryData?.categories.filter(c => c.accuracy < 70).length || 0} Categories
                </p>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Reset Exam Scores Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Reset Exam Scores</h3>
              </div>
              <button 
                onClick={() => {
                  setShowResetModal(false);
                  setConfirmText('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-medium">
                  This will permanently delete all your exam history and statistics:
                </p>
                <ul className="mt-2 text-amber-700 text-sm space-y-1">
                  <li>• All {stats?.totalSessions || 0} exam sessions</li>
                  <li>• Pass rate and score history</li>
                  <li>• Category performance data</li>
                  <li>• Streak and progress tracking</li>
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-emerald-800 text-sm font-medium flex items-center gap-2">
                  <BookOpen size={16} />
                  Your study progress will be preserved
                </p>
                <p className="text-emerald-700 text-sm mt-1">
                  Lessons studied and mastered questions will not be affected.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-rose-600">RESET</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESET here..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all font-mono"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    setConfirmText('');
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={confirmText !== 'RESET' || resetMutation.isPending}
                  className={clsx(
                    "flex-1 px-4 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2",
                    confirmText === 'RESET' && !resetMutation.isPending
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {resetMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw size={18} />
                      Reset Scores
                    </>
                  )}
                </button>
              </div>

              {resetMutation.isError && (
                <p className="text-rose-600 text-sm text-center font-medium">
                  Failed to reset scores. Please try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

