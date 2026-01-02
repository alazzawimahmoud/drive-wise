import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { 
  Trophy, 
  Target, 
  Flame, 
  ChevronRight, 
  BookOpen, 
  LogOut,
  AlertCircle
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
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold">
            <Target size={20} /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <BookOpen size={20} /> Lessons
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Trophy size={20} /> Exam History
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100">
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
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user?.displayName}!</h2>
            <p className="text-slate-500">You're making great progress on your driving theory.</p>
          </div>
          
          <button 
            onClick={() => navigate('/exam')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all transform hover:scale-105"
          >
            Start Mock Exam
          </button>
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

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900">Category Performance</h3>
            <button className="text-indigo-600 font-bold text-sm flex items-center gap-1">
              View All <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categoryData?.categories.slice(0, 3).map(cat => (
              <div key={cat.slug} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4">{cat.title}</h4>
                <div className="w-full bg-slate-100 h-2 rounded-full mb-2">
                  <div 
                    className={clsx(
                      "h-full rounded-full transition-all",
                      cat.accuracy >= 80 ? "bg-emerald-500" : cat.accuracy >= 60 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${cat.accuracy}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-400">Accuracy</span>
                  <span className={clsx(
                    cat.accuracy >= 80 ? "text-emerald-600" : cat.accuracy >= 60 ? "text-amber-600" : "text-rose-600"
                  )}>{cat.accuracy}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

