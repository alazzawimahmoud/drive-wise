import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { BookOpen, AlertTriangle, ChevronRight, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface LessonProgress {
  questionsSeen: number;
  questionsMastered: number;
  percentComplete: number;
  lastStudiedAt: string | null;
}

interface LessonWithProgress {
  id: number;
  number: number;
  slug: string;
  title: string | null;
  description: string | null;
  questionCount: number;
  majorFaultCount: number;
  progress: LessonProgress | null;
}

export const LessonsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: lessons, isLoading } = useQuery<LessonWithProgress[]>({
    queryKey: ['study-lessons'],
    queryFn: async () => {
      const res = await api.get('/study/lessons', { params: { locale: 'nl-BE' } });
      return res.data;
    },
  });

  const { data: overview } = useQuery({
    queryKey: ['study-progress'],
    queryFn: async () => {
      const res = await api.get('/study/progress');
      return res.data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('nl-BE', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900">Study Lessons</h1>
              <p className="text-sm text-slate-500">Master the theory, ace the exam</p>
            </div>
          </div>
          
          {user?.avatarUrl && (
            <img 
              src={user.avatarUrl} 
              alt={user.displayName || 'User'}
              className="w-10 h-10 rounded-full border-2 border-slate-200 shadow-sm"
            />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Progress Overview */}
        {overview && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Your Progress</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-indigo-600">{overview.lessonsStarted}</div>
                <div className="text-xs text-slate-500 font-medium">Lessons Started</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-600">{overview.lessonsCompleted}</div>
                <div className="text-xs text-slate-500 font-medium">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-slate-700">{overview.questionsSeen}</div>
                <div className="text-xs text-slate-500 font-medium">Questions Seen</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-amber-600">{overview.questionsNeedReview}</div>
                <div className="text-xs text-slate-500 font-medium">Need Review</div>
              </div>
            </div>
            
            {/* Overall Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-400">OVERALL PROGRESS</span>
                <span className="text-indigo-600">{overview.overallProgress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${overview.overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Lessons Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lessons?.map((lesson) => {
            const isCompleted = lesson.progress && lesson.progress.percentComplete >= 100;
            const isStarted = lesson.progress && lesson.progress.questionsSeen > 0;
            
            return (
              <button
                key={lesson.id}
                onClick={() => navigate(`/study/${lesson.slug}`)}
                className={clsx(
                  "group bg-white rounded-2xl border-2 p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5",
                  isCompleted 
                    ? "border-emerald-200 hover:border-emerald-400" 
                    : isStarted 
                      ? "border-indigo-200 hover:border-indigo-400"
                      : "border-slate-200 hover:border-slate-300"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors",
                    isCompleted 
                      ? "bg-emerald-100 text-emerald-600" 
                      : isStarted
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                  )}>
                    {lesson.number}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {lesson.majorFaultCount > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                        <AlertTriangle size={12} />
                        {lesson.majorFaultCount}
                      </span>
                    )}
                    {isCompleted && (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-bold text-slate-900 mb-1 line-clamp-1">
                  {lesson.title || `Lesson ${lesson.number}`}
                </h3>
                
                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} />
                    {lesson.questionCount} questions
                  </span>
                  {lesson.progress?.lastStudiedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(lesson.progress.lastStudiedAt)}
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={clsx(
                        "h-full rounded-full transition-all duration-300",
                        isCompleted 
                          ? "bg-emerald-500" 
                          : "bg-indigo-500"
                      )}
                      style={{ width: `${lesson.progress?.percentComplete || 0}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">
                    {lesson.progress 
                      ? `${lesson.progress.questionsSeen}/${lesson.questionCount} seen`
                      : 'Not started'
                    }
                  </span>
                  <ChevronRight 
                    size={16} 
                    className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" 
                  />
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

