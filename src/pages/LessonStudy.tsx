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
  HelpCircle,
  RefreshCcw,
  Keyboard
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
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

  const resetMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/study/lessons/${slug}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-lesson', slug] });
      queryClient.invalidateQueries({ queryKey: ['study-progress'] });
      setCurrentIndex(0);
      setShowResetConfirm(false);
    },
  });

  const handleResetLesson = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    resetMutation.mutate();
  };

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
      case 'i':
      case 'I':
        e.preventDefault();
        handleMarkStatus('needs_review');
        break;
      case '?':
        e.preventDefault();
        setShowShortcuts(prev => !prev);
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">
                  Lesson {lesson.number}: {lesson.title}
                </h1>
                <button
                  onClick={handleResetLesson}
                  disabled={resetMutation.isPending}
                  className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  title="Reset lesson progress"
                >
                  <RefreshCcw size={14} className={resetMutation.isPending ? "animate-spin" : ""} />
                </button>
              </div>
              <p className="text-sm text-slate-500">{lesson.questionCount} questions total</p>
            </div>
            {/* Filter Dropdown */}
            <div className="relative">
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

              {/* Filter Dropdown Panel */}
              {showFilters && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowFilters(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Filters</span>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => setFilters({
                            majorFaultsOnly: false,
                            unseenOnly: false,
                            needsReview: false,
                            bookmarked: false,
                            shuffle: false,
                          })}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        >
                          <X size={10} />
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <FilterDropdownItem 
                        active={filters.majorFaultsOnly} 
                        onClick={() => toggleFilter('majorFaultsOnly')}
                        icon={<AlertTriangle size={14} />}
                        label="Major Faults"
                        description="Important questions"
                      />
                      <FilterDropdownItem 
                        active={filters.unseenOnly} 
                        onClick={() => toggleFilter('unseenOnly')}
                        icon={<Eye size={14} />}
                        label="Unseen"
                        description="Not studied yet"
                      />
                      <FilterDropdownItem 
                        active={filters.needsReview} 
                        onClick={() => toggleFilter('needsReview')}
                        icon={<RotateCcw size={14} />}
                        label="Review"
                        description="Marked for review"
                      />
                      <FilterDropdownItem 
                        active={filters.bookmarked} 
                        onClick={() => toggleFilter('bookmarked')}
                        icon={<Bookmark size={14} />}
                        label="Saved"
                        description="Bookmarked questions"
                      />
                    </div>
                    <div className="border-t border-slate-100 p-1.5">
                      <FilterDropdownItem 
                        active={filters.shuffle} 
                        onClick={() => toggleFilter('shuffle')}
                        icon={<Shuffle size={14} />}
                        label="Shuffle"
                        description="Randomize order"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                  <RefreshCcw size={20} className="text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Reset Progress</h3>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                This will reset all progress for this lesson. All questions will be marked as unseen.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReset}
                  disabled={resetMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {resetMutation.isPending ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
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
          
          <div className="flex items-center gap-1.5">
            <p className={clsx(
              "font-semibold text-slate-600",
              showImmersive ? "text-sm" : "text-xs"
            )}>
              {lesson.title}
            </p>
            <button
              onClick={handleResetLesson}
              disabled={resetMutation.isPending}
              className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
              title="Reset lesson progress"
            >
              <RefreshCcw size={12} className={resetMutation.isPending ? "animate-spin" : ""} />
            </button>
          </div>
          
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
              onClick={() => setShowShortcuts(true)}
              className="hidden sm:block p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={16} />
            </button>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  "relative p-1.5 rounded-lg transition-colors",
                  activeFilterCount > 0 ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"
                )}
                title="Filters"
              >
                <Filter size={16} />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filter Dropdown Panel */}
              {showFilters && (
                <>
                  {/* Backdrop to close on click outside */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowFilters(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Filters</span>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => setFilters({
                            majorFaultsOnly: false,
                            unseenOnly: false,
                            needsReview: false,
                            bookmarked: false,
                            shuffle: false,
                          })}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        >
                          <X size={10} />
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <FilterDropdownItem 
                        active={filters.majorFaultsOnly} 
                        onClick={() => toggleFilter('majorFaultsOnly')}
                        icon={<AlertTriangle size={14} />}
                        label="Major Faults"
                        description="Important questions"
                      />
                      <FilterDropdownItem 
                        active={filters.unseenOnly} 
                        onClick={() => toggleFilter('unseenOnly')}
                        icon={<Eye size={14} />}
                        label="Unseen"
                        description="Not studied yet"
                      />
                      <FilterDropdownItem 
                        active={filters.needsReview} 
                        onClick={() => toggleFilter('needsReview')}
                        icon={<RotateCcw size={14} />}
                        label="Review"
                        description="Marked for review"
                      />
                      <FilterDropdownItem 
                        active={filters.bookmarked} 
                        onClick={() => toggleFilter('bookmarked')}
                        icon={<Bookmark size={14} />}
                        label="Saved"
                        description="Bookmarked questions"
                      />
                    </div>
                    <div className="border-t border-slate-100 p-1.5">
                      <FilterDropdownItem 
                        active={filters.shuffle} 
                        onClick={() => toggleFilter('shuffle')}
                        icon={<Shuffle size={14} />}
                        label="Shuffle"
                        description="Randomize order"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
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
                willBeFilteredOnMark={filters.unseenOnly || filters.needsReview}
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
                willBeFilteredOnMark={filters.unseenOnly || filters.needsReview}
              />
            </div>
          </>
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                <RefreshCcw size={20} className="text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Reset Progress</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6">
              This will reset all progress for this lesson. All questions will be marked as unseen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                disabled={resetMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Keyboard size={20} className="text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <ShortcutRow keys={['←']} description="Previous question" />
              <ShortcutRow keys={['→']} description="Next question" />
              <ShortcutRow keys={['Space']} description="Mark as mastered & next" />
              <ShortcutRow keys={['I']} description="Mark for review" />
              <ShortcutRow keys={['B']} description="Toggle bookmark" />
              <ShortcutRow keys={['?']} description="Show shortcuts" />
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">?</kbd> to toggle this panel
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Dropdown Item Component
const FilterDropdownItem = ({ 
  active, 
  onClick, 
  icon, 
  label,
  description
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  description: string;
}) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all text-left",
      active 
        ? "bg-indigo-50" 
        : "hover:bg-slate-50"
    )}
  >
    <div className={clsx(
      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
    )}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className={clsx(
        "text-sm font-semibold",
        active ? "text-indigo-600" : "text-slate-700"
      )}>
        {label}
      </div>
      <div className="text-xs text-slate-400 truncate">{description}</div>
    </div>
    <div className={clsx(
      "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
      active ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
    )}>
      {active && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  </button>
);

// Filter Button Component (for empty state)
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

// Shortcut Row Component
const ShortcutRow = ({ keys, description }: { keys: string[]; description: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-600">{description}</span>
    <div className="flex gap-1">
      {keys.map((key, i) => (
        <kbd key={i} className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-700 min-w-[28px] text-center">
          {key}
        </kbd>
      ))}
    </div>
  </div>
);

