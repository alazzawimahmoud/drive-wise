import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { 
  BookOpen, 
  AlertTriangle, 
  Bookmark, 
  Check, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft
} from 'lucide-react';

interface Choice {
  position: number;
  text: string | null;
  imageUrl: string | null;
}

interface Lesson {
  number: number;
  slug: string;
  title: string | null;
}

interface StudyQuestion {
  id: number;
  questionText: string | null;
  answerType: string;
  answer: number | string | number[];
  isMajorFault: boolean;
  explanation: string | null;
  choices: Choice[];
  imageUrl: string | null;
  lessons: Lesson[];
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

interface StudyCardImmersiveProps {
  question: StudyQuestion;
  onPrevious: () => void;
  onNext: () => void;
  onMarkStatus: (status: 'seen' | 'mastered' | 'needs_review') => void;
  onToggleBookmark: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  currentIndex: number;
  totalQuestions: number;
}

export const StudyCardImmersive: React.FC<StudyCardImmersiveProps> = ({
  question,
  onPrevious,
  onNext,
  onMarkStatus,
  onToggleBookmark,
  isFirstQuestion,
  isLastQuestion,
  currentIndex,
  totalQuestions,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const correctAnswer = question.answer;
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;

  // Reset image loaded state when question changes
  useEffect(() => {
    setImageLoaded(false);
  }, [question.id]);
  
  const isCorrectChoice = (position: number) => {
    if (typeof correctAnswer === 'number') {
      return position === correctAnswer;
    }
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.includes(position);
    }
    return false;
  };

  const hasImage = !!question.imageUrl;

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Main Content Area - Split Panel */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Image or Placeholder */}
        <div className={clsx(
          "flex-shrink-0 bg-slate-50 border-r border-slate-200 flex items-center justify-center overflow-hidden",
          hasImage ? "w-[40%]" : "w-0 hidden"
        )}>
          <AnimatePresence mode="wait">
            {hasImage && (
              <motion.div
                key={question.id + '-image'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full flex items-center justify-center p-4 relative"
              >
                {/* Loading skeleton */}
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                )}
                <img
                  src={question.imageUrl!}
                  alt="Question scenario"
                  onLoad={() => setImageLoaded(true)}
                  className={clsx(
                    "max-w-full max-h-full object-contain rounded-lg shadow-md transition-opacity duration-300",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Panel - Question Content */}
        <div className={clsx(
          "flex-1 flex flex-col min-h-0 overflow-hidden",
          hasImage ? "w-[60%]" : "w-full max-w-4xl mx-auto"
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 overflow-y-auto p-4 lg:p-5"
            >
            {/* Category Badge & Major Fault */}
            <div className="flex items-center gap-2 mb-3">
              {question.category.title && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                  {question.category.title}
                </span>
              )}
              {question.isMajorFault && (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                  <AlertTriangle size={12} />
                  Major Fault
                </span>
              )}
            </div>

            {/* Question Text */}
            <h2 className="text-lg lg:text-xl font-bold text-slate-900 leading-snug mb-4">
              {question.questionText}
            </h2>

            {/* Choices / Answer */}
            <div className="space-y-2 mb-4">
              {question.answerType === 'INPUT' ? (
                <div className="p-3 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                    Correct Answer
                  </span>
                  <span className="text-xl font-black text-emerald-800">{String(correctAnswer)}</span>
                </div>
              ) : question.answerType === 'ORDER' ? (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Correct Order
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(correctAnswer as number[]).map((pos, idx) => {
                      const choice = question.choices.find(c => c.position === pos);
                      return (
                        <div key={idx} className="relative">
                          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs z-10 shadow-sm">
                            {idx + 1}
                          </div>
                          {choice?.imageUrl ? (
                            <img 
                              src={choice.imageUrl} 
                              alt="" 
                              className="w-16 h-16 object-contain border-2 border-emerald-200 rounded-lg bg-white p-1"
                            />
                          ) : (
                            <div className="w-16 h-16 border-2 border-emerald-200 rounded-lg bg-emerald-50 flex items-center justify-center p-1">
                              <span className="text-xs font-medium text-center">{choice?.text}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // SINGLE_CHOICE or YES_NO
                (() => {
                  const hasImageChoices = question.choices.some(c => c.imageUrl && !c.text);
                  
                  if (hasImageChoices) {
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {question.choices.map((choice) => {
                          const isCorrect = isCorrectChoice(choice.position);
                          return (
                            <div
                              key={choice.position}
                              className={clsx(
                                "relative aspect-square rounded-lg border-2 overflow-hidden bg-white transition-all",
                                isCorrect 
                                  ? "border-emerald-500 ring-2 ring-emerald-100 shadow-md" 
                                  : "border-slate-200 opacity-50"
                              )}
                            >
                              <div className={clsx(
                                "absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs z-10",
                                isCorrect 
                                  ? "bg-emerald-500 text-white shadow-sm" 
                                  : "bg-white/90 text-slate-500 border border-slate-200"
                              )}>
                                {String.fromCharCode(65 + choice.position)}
                              </div>
                              {choice.imageUrl && (
                                <img 
                                  src={choice.imageUrl} 
                                  alt=""
                                  className="w-full h-full object-contain p-2"
                                />
                              )}
                              {isCorrect && (
                                <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md">
                                    <Check size={22} strokeWidth={3} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Text-based choices
                  return question.choices.map((choice) => {
                    const isCorrect = isCorrectChoice(choice.position);
                    return (
                      <div
                        key={choice.position}
                        className={clsx(
                          "p-3 rounded-lg border-2 flex items-center gap-3 transition-all",
                          isCorrect 
                            ? "border-emerald-500 bg-emerald-50 shadow-sm" 
                            : "border-slate-100 bg-white opacity-50"
                        )}
                      >
                        <span className={clsx(
                          "w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                          isCorrect 
                            ? "bg-emerald-500 text-white" 
                            : "bg-slate-100 text-slate-400"
                        )}>
                          {isCorrect ? <Check size={14} strokeWidth={3} /> : String.fromCharCode(65 + choice.position)}
                        </span>
                        <span className={clsx(
                          "text-sm font-medium",
                          isCorrect ? "text-emerald-900" : "text-slate-600"
                        )}>
                          {choice.text}
                        </span>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Explanation */}
            {question.explanation && (
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 mb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BookOpen size={14} className="text-indigo-600" />
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Explanation</span>
                </div>
                <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            )}

            {/* Related Lessons */}
            {question.lessons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {question.lessons.map((lesson) => (
                  <span 
                    key={lesson.slug}
                    className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
                  >
                    {lesson.number}. {lesson.title}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Fixed Footer Action Bar */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Previous Button */}
          <button
            onClick={onPrevious}
            disabled={isFirstQuestion}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
              isFirstQuestion
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Center Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onMarkStatus('needs_review')}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                question.studyStatus?.status === 'needs_review'
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-amber-600 hover:bg-amber-50 border border-amber-200"
              )}
              title="Mark for review (R)"
            >
              <RotateCcw size={16} />
              <span className="hidden md:inline">Review</span>
            </button>

            <button
              onClick={onToggleBookmark}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                question.isBookmarked 
                  ? "bg-indigo-500 text-white shadow-sm" 
                  : "text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
              )}
              title="Bookmark (B)"
            >
              <Bookmark size={16} fill={question.isBookmarked ? 'currentColor' : 'none'} />
              <span className="hidden md:inline">Bookmark</span>
            </button>

            <button
              onClick={() => {
                onMarkStatus('mastered');
                if (!isLastQuestion) onNext();
              }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                question.studyStatus?.status === 'mastered'
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
              )}
              title="Got it! (Space)"
            >
              <Check size={16} />
              <span className="hidden md:inline">Got It</span>
            </button>
          </div>

          {/* Next Button */}
          <button
            onClick={onNext}
            disabled={isLastQuestion}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
              isLastQuestion
                ? "text-slate-300 cursor-not-allowed"
                : "text-indigo-600 hover:bg-indigo-50"
            )}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            {currentIndex + 1} / {totalQuestions}
          </span>
        </div>
      </div>
    </div>
  );
};
