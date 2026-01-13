import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { 
  AlertTriangle, 
  Eye, 
  Bookmark, 
  RotateCcw, 
  Shuffle,
  Filter,
  X,
  ChevronLeft,
  Maximize2,
  Minimize2,
  HelpCircle
} from 'lucide-react';
import { StudyCard } from '../components/StudyCard';
import { StudyCardImmersive } from '../components/StudyCardImmersive';
import api from '../lib/api';

type ViewMode = 'compact' | 'immersive';

interface StudyQuestion {
  id: number;
  questionText: string | null;
  answerType: string;
  answer: number | string | number[];
  isMajorFault: boolean;
  explanation: string | null;
  choices: {
    position: number;
    text: string | null;
    imageUrl: string | null;
  }[];
  imageUrl: string | null;
  lessons: {
    number: number;
    slug: string;
    title: string | null;
  }[];
  category: {
    slug: string | null;
    title: string | null;
  };
  studyStatus: {
    status: string;
    timesSeen: number;
    lastSeenAt: string;
  } | null;
  isBookmarked: boolean;
}

interface LessonData {
  lesson: {
    id: number;
    number: number;
    slug: string;
    title: string | null;
    description: string | null;
    questionCount: number;
  };
  questions: StudyQuestion[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface Filters {
  majorFaultsOnly: boolean;
  unseenOnly: boolean;
  needsReview: boolean;
  bookmarked: boolean;
  shuffle: boolean;
}

export const LessonStudy = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    majorFaultsOnly: false,
    unseenOnly: false,
    needsReview: false,
    bookmarked: false,
    shuffle: false,
  });
  
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studyViewMode');
      if (saved === 'compact' || saved === 'immersive') {
        return saved;
      }
    }
    return 'compact';
  });

  // Quiz mode state with localStorage persistence
  const [quizMode, setQuizMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('studyQuizMode') === 'true';
    }
    return false; // Default: OFF (flashcard mode)
  });

  // Track if screen is large enough for immersive view
  const [isLargeScreen, setIsLargeScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 1024px)').matches;
    }
    return false;
  });

  // Listen for screen size changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsLargeScreen(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('studyViewMode', viewMode);
  }, [viewMode]);

  // Persist quiz mode preference
  useEffect(() => {
    localStorage.setItem('studyQuizMode', String(quizMode));
  }, [quizMode]);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'compact' ? 'immersive' : 'compact');
  };

  const { data, isLoading } = useQuery<LessonData>({
    queryKey: ['study-lesson', slug, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ locale: 'nl-BE' });
      if (filters.majorFaultsOnly) params.append('majorFaultsOnly', 'true');
      if (filters.unseenOnly) params.append('unseenOnly', 'true');
      if (filters.needsReview) params.append('needsReview', 'true');
      if (filters.bookmarked) params.append('bookmarked', 'true');
      if (filters.shuffle) params.append('shuffle', 'true');
      
      const res = await api.get(`/study/lessons/${slug}/questions?${params.toString()}`);
      return res.data;
    },
    enabled: !!slug,
  });

  // Reset index when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [filters]);

  const markMutation = useMutation({
    mutationFn: async ({ questionId, status }: { questionId: number; status: string }) => {
      await api.post('/study/mark', { questionId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-lesson', slug] });
      queryClient.invalidateQueries({ queryKey: ['study-progress'] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ questionId, action }: { questionId: number; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        await api.post('/bookmarks', { questionId, type: 'saved' });
      } else {
        await api.delete(`/bookmarks/question/${questionId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-lesson', slug] });
    },
  });

  const handleMarkStatus = (status: 'seen' | 'mastered' | 'needs_review') => {
    if (!data?.questions[currentIndex]) return;
    markMutation.mutate({ questionId: data.questions[currentIndex].id, status });
  };

  const handleToggleBookmark = () => {
    if (!data?.questions[currentIndex]) return;
    const question = data.questions[currentIndex];
    bookmarkMutation.mutate({ 
      questionId: question.id, 
      action: question.isBookmarked ? 'remove' : 'add' 
    });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (data && currentIndex < data.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const toggleFilter = (key: keyof Filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handlePrevious();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleNext();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        handleMarkStatus('needs_review');
        break;
      case 'b':
      case 'B':
        e.preventDefault();
        handleToggleBookmark();
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        handleMarkStatus('mastered');
        if (data && currentIndex < data.questions.length - 1) {
          handleNext();
        }
        break;
    }
  }, [currentIndex, data]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 font-medium">Lesson not found</p>
          <button 
            onClick={() => navigate('/lessons')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold"
          >
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }

  const { lesson, questions } = data;
  const currentQuestion = questions[currentIndex];

  // Empty state when no questions match filters
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-slate-900">
                Lesson {lesson.number}: {lesson.title}
              </h1>
              <p className="text-sm text-slate-500">{lesson.questionCount} questions total</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "relative p-2 rounded-lg transition-colors",
                activeFilterCount > 0 ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"
              )}
            >
              <Filter size={20} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          
          {/* Filter Panel */}
          {showFilters && (
            <div className="max-w-2xl mx-auto mt-4 p-4 bg-slate-50 rounded-xl">
              <div className="flex flex-wrap gap-2">
                <FilterButton 
                  active={filters.majorFaultsOnly} 
                  onClick={() => toggleFilter('majorFaultsOnly')}
                  icon={<AlertTriangle size={14} />}
                  label="Major Faults Only"
                />
                <FilterButton 
                  active={filters.unseenOnly} 
                  onClick={() => toggleFilter('unseenOnly')}
                  icon={<Eye size={14} />}
                  label="Unseen Only"
                />
                <FilterButton 
                  active={filters.needsReview} 
                  onClick={() => toggleFilter('needsReview')}
                  icon={<RotateCcw size={14} />}
                  label="Needs Review"
                />
                <FilterButton 
                  active={filters.bookmarked} 
                  onClick={() => toggleFilter('bookmarked')}
                  icon={<Bookmark size={14} />}
                  label="Bookmarked"
                />
                <FilterButton 
                  active={filters.shuffle} 
                  onClick={() => toggleFilter('shuffle')}
                  icon={<Shuffle size={14} />}
                  label="Shuffle"
                />
              </div>
            </div>
          )}
        </header>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter size={24} className="text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No questions match your filters</h2>
            <p className="text-slate-500 mb-6">Try removing some filters or study different questions.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setFilters({
                  majorFaultsOnly: false,
                  unseenOnly: false,
                  needsReview: false,
                  bookmarked: false,
                  shuffle: false,
                })}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold"
              >
                Clear Filters
              </button>
              <button
                onClick={() => navigate('/lessons')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold"
              >
                Back to Lessons
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine if we should show immersive view (only on large screens AND preference is set)
  const showImmersive = viewMode === 'immersive' && isLargeScreen;

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">
      {/* Header with Back Button, Question Counter, View Toggle, and Filters */}
      <header className={clsx(
        "bg-white border-b border-slate-200 px-3 py-2 flex-shrink-0",
        showImmersive && "lg:px-6"
      )}>
        <div className={clsx(
          "flex items-center justify-between",
          !showImmersive && "max-w-2xl mx-auto"
        )}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/lessons')}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Back to lessons"
            >
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            {/* Question counter only shown in compact mode */}
            {!showImmersive && (
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-slate-900">{currentIndex + 1}</span>
                <span className="text-slate-300 font-bold text-xs">/</span>
                <span className="text-xs font-bold text-slate-400">{questions.length}</span>
              </div>
            )}
          </div>
          
          <p className={clsx(
            "font-semibold text-slate-600 truncate",
            showImmersive ? "text-sm max-w-[50%]" : "text-xs max-w-[40%]"
          )}>
            {lesson.title}
          </p>
          
          <div className="flex items-center gap-2">
            {/* Quiz Mode Toggle */}
            <button
              onClick={() => setQuizMode(!quizMode)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                quizMode 
                  ? "bg-amber-500 text-white" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              title={quizMode ? "Disable Quiz Mode" : "Enable Quiz Mode"}
            >
              <HelpCircle size={14} />
              <span>Quiz</span>
            </button>

            {/* View Toggle - Only show on lg screens */}
            <button
              onClick={toggleViewMode}
              className={clsx(
                "hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                showImmersive 
                  ? "bg-indigo-600 text-white" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              title={showImmersive ? "Switch to Compact View" : "Switch to Immersive View"}
            >
              {showImmersive ? (
                <>
                  <Minimize2 size={14} />
                  <span>Compact</span>
                </>
              ) : (
                <>
                  <Maximize2 size={14} />
                  <span>Immersive</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "relative p-1.5 rounded-lg transition-colors",
                activeFilterCount > 0 ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"
              )}
            >
              <Filter size={16} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Filter Panel */}
        {showFilters && (
          <div className={clsx(
            "mt-3 p-3 bg-slate-50 rounded-xl",
            !showImmersive && "max-w-2xl mx-auto"
          )}>
            <div className="flex flex-wrap gap-2">
              <FilterButton 
                active={filters.majorFaultsOnly} 
                onClick={() => toggleFilter('majorFaultsOnly')}
                icon={<AlertTriangle size={14} />}
                label="Major Faults"
              />
              <FilterButton 
                active={filters.unseenOnly} 
                onClick={() => toggleFilter('unseenOnly')}
                icon={<Eye size={14} />}
                label="Unseen"
              />
              <FilterButton 
                active={filters.needsReview} 
                onClick={() => toggleFilter('needsReview')}
                icon={<RotateCcw size={14} />}
                label="Review"
              />
              <FilterButton 
                active={filters.bookmarked} 
                onClick={() => toggleFilter('bookmarked')}
                icon={<Bookmark size={14} />}
                label="Saved"
              />
              <FilterButton 
                active={filters.shuffle} 
                onClick={() => toggleFilter('shuffle')}
                icon={<Shuffle size={14} />}
                label="Shuffle"
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({
                    majorFaultsOnly: false,
                    unseenOnly: false,
                    needsReview: false,
                    bookmarked: false,
                    shuffle: false,
                  })}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Study Card - Compact or Immersive */}
      <main className={clsx(
        "flex-1 min-h-0 overflow-hidden",
        showImmersive ? "p-3 lg:p-4" : "p-2 md:p-4"
      )}>
        {currentQuestion && (
          <>
            {/* Compact View (default, always used on small screens) */}
            <div className={clsx(showImmersive ? "hidden" : "block h-full")}>
              <StudyCard
                question={currentQuestion}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onMarkStatus={handleMarkStatus}
                onToggleBookmark={handleToggleBookmark}
                isFirstQuestion={currentIndex === 0}
                isLastQuestion={currentIndex === questions.length - 1}
                quizMode={quizMode}
              />
            </div>
            
            {/* Immersive View (only on lg+ screens when enabled) */}
            <div className={clsx(showImmersive ? "block h-full" : "hidden")}>
              <StudyCardImmersive
                question={currentQuestion}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onMarkStatus={handleMarkStatus}
                onToggleBookmark={handleToggleBookmark}
                isFirstQuestion={currentIndex === 0}
                isLastQuestion={currentIndex === questions.length - 1}
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                quizMode={quizMode}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

// Filter Button Component
const FilterButton = ({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
      active 
        ? "bg-indigo-600 text-white shadow-md" 
        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
    )}
  >
    {icon}
    {label}
  </button>
);

