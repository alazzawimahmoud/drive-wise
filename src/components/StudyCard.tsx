import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { BookOpen, AlertTriangle, Bookmark, Check, RotateCcw, ChevronRight, ChevronLeft, X, Eye } from 'lucide-react';

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

interface StudyCardProps {
  question: StudyQuestion;
  onPrevious: () => void;
  onNext: () => void;
  onMarkStatus: (status: 'seen' | 'mastered' | 'needs_review') => void;
  onToggleBookmark: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  quizMode: boolean;
}

export const StudyCard: React.FC<StudyCardProps> = ({
  question,
  onPrevious,
  onNext,
  onMarkStatus,
  onToggleBookmark,
  isFirstQuestion,
  isLastQuestion,
  quizMode,
}) => {
  const correctAnswer = question.answer;
  
  // Quiz mode state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
  }, [question.id]);

  // Determine if we should show the answer (always in flashcard mode, or after answering in quiz mode)
  const showAnswer = !quizMode || hasAnswered;

  const handleChoiceClick = (position: number) => {
    if (!quizMode || hasAnswered) return;
    setSelectedAnswer(position);
    setHasAnswered(true);
  };

  const handleRevealAnswer = () => {
    setHasAnswered(true);
  };
  
  const isCorrectChoice = (position: number) => {
    if (typeof correctAnswer === 'number') {
      return position === correctAnswer;
    }
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.includes(position);
    }
    return false;
  };

  return (
    <div className="w-full max-w-2xl mx-auto h-full flex flex-col">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border-2 border-slate-100 flex flex-col h-full">
        {/* Content */}
        <motion.div
          key={question.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col flex-1 min-h-0 overflow-y-auto"
        >
          {/* Image */}
          {question.imageUrl && (
            <div className="w-full bg-slate-50 relative border-b border-slate-100 flex-shrink-0">
              <img
                src={question.imageUrl}
                alt="Question scenario"
                className="w-full max-h-[30vh] object-contain"
              />
            </div>
          )}

          <div className="p-4 md:p-6 flex flex-col flex-1 min-h-0">
            {/* Category Badge & Major Fault */}
            {(question.category.title || question.isMajorFault) && (
              <div className="flex items-center gap-2 mb-3 opacity-65">
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
            )}

            {/* Question Text */}
            <h2 className="text-base md:text-lg font-bold text-slate-900 leading-tight mb-4">
              {question.questionText}
            </h2>

            {/* Choices / Answer */}
            <div className="space-y-2 mb-6">
              {question.answerType === 'INPUT' ? (
                showAnswer ? (
                  <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                      Correct Answer
                    </span>
                    <span className="text-xl font-black text-emerald-800">{String(correctAnswer)}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleRevealAnswer}
                    className="w-full p-4 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} className="text-slate-600" />
                    <span className="text-sm font-bold text-slate-600">Reveal Answer</span>
                  </button>
                )
              ) : question.answerType === 'ORDER' ? (
                showAnswer ? (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Correct Order
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {(correctAnswer as number[]).map((pos, idx) => {
                        const choice = question.choices.find(c => c.position === pos);
                        return (
                          <div key={idx} className="relative">
                            <div className="absolute -top-2 -left-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs z-10">
                              {idx + 1}
                            </div>
                            {choice?.imageUrl ? (
                              <img 
                                src={choice.imageUrl} 
                                alt="" 
                                className="w-20 h-20 object-contain border-2 border-emerald-200 rounded-xl bg-white p-2"
                              />
                            ) : (
                              <div className="w-20 h-20 border-2 border-emerald-200 rounded-xl bg-emerald-50 flex items-center justify-center p-2">
                                <span className="text-xs font-medium text-center">{choice?.text}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Arrange in correct order
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {question.choices.map((choice) => (
                        <div key={choice.position} className="relative">
                          {choice.imageUrl ? (
                            <img 
                              src={choice.imageUrl} 
                              alt="" 
                              className="w-20 h-20 object-contain border-2 border-slate-200 rounded-xl bg-white p-2"
                            />
                          ) : (
                            <div className="w-20 h-20 border-2 border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center p-2">
                              <span className="text-xs font-medium text-center">{choice.text}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleRevealAnswer}
                      className="w-full p-3 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye size={18} className="text-slate-600" />
                      <span className="text-sm font-bold text-slate-600">Reveal Correct Order</span>
                    </button>
                  </div>
                )
              ) : (
                // SINGLE_CHOICE or YES_NO
                (() => {
                  const hasImageChoices = question.choices.some(c => c.imageUrl && !c.text);
                  
                  if (hasImageChoices) {
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        {question.choices.map((choice) => {
                          const isCorrect = isCorrectChoice(choice.position);
                          const isSelected = selectedAnswer === choice.position;
                          const isWrongSelection = showAnswer && isSelected && !isCorrect;
                          
                          // Determine styling based on quiz mode and answer state
                          let borderClass = "border-slate-200";
                          let opacityClass = "";
                          let ringClass = "";
                          
                          if (showAnswer) {
                            if (isCorrect) {
                              borderClass = "border-emerald-500";
                              ringClass = "ring-2 ring-emerald-100";
                            } else if (isWrongSelection) {
                              borderClass = "border-rose-500";
                              ringClass = "ring-2 ring-rose-100";
                            } else {
                              opacityClass = "opacity-65";
                            }
                          } else if (quizMode) {
                            borderClass = "border-slate-200 hover:border-indigo-300 cursor-pointer";
                          }
                          
                          return (
                            <div
                              key={choice.position}
                              onClick={() => handleChoiceClick(choice.position)}
                              className={clsx(
                                "relative aspect-square rounded-xl border-2 overflow-hidden bg-white transition-all",
                                borderClass,
                                opacityClass,
                                ringClass
                              )}
                            >
                              <div className={clsx(
                                "absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs z-10",
                                showAnswer && isCorrect 
                                  ? "bg-emerald-500 text-white" 
                                  : showAnswer && isWrongSelection
                                    ? "bg-rose-500 text-white"
                                    : "bg-white/90 text-slate-500 border border-slate-200"
                              )}>
                                {String.fromCharCode(65 + choice.position)}
                              </div>
                              {choice.imageUrl && (
                                <img 
                                  src={choice.imageUrl} 
                                  alt=""
                                  className="w-full h-full object-contain p-3"
                                />
                              )}
                              {showAnswer && isCorrect && (
                                <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                                    <Check size={24} strokeWidth={3} />
                                  </div>
                                </div>
                              )}
                              {showAnswer && isWrongSelection && (
                                <div className="absolute inset-0 bg-rose-500/10 flex items-center justify-center">
                                  <div className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center">
                                    <X size={24} strokeWidth={3} />
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
                    const isSelected = selectedAnswer === choice.position;
                    const isWrongSelection = showAnswer && isSelected && !isCorrect;
                    
                    // Determine styling based on quiz mode and answer state
                    let containerClass = "border-slate-100 bg-white opacity-65";
                    let iconClass = "bg-slate-100 text-slate-400";
                    let textClass = "text-slate-600";
                    let icon: React.ReactNode = String.fromCharCode(65 + choice.position);
                    
                    if (showAnswer) {
                      if (isCorrect) {
                        containerClass = "border-emerald-500 bg-emerald-50";
                        iconClass = "bg-emerald-500 text-white";
                        textClass = "text-emerald-900";
                        icon = <Check size={14} strokeWidth={3} />;
                      } else if (isWrongSelection) {
                        containerClass = "border-rose-500 bg-rose-50";
                        iconClass = "bg-rose-500 text-white";
                        textClass = "text-rose-900";
                        icon = <X size={14} strokeWidth={3} />;
                      }
                    } else if (quizMode) {
                      containerClass = "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all";
                      iconClass = "bg-slate-100 text-slate-500";
                      textClass = "text-slate-700";
                    }
                    
                    return (
                      <div
                        key={choice.position}
                        onClick={() => handleChoiceClick(choice.position)}
                        className={clsx(
                          "p-3 rounded-xl border-2 flex items-center gap-3",
                          containerClass
                        )}
                      >
                        <span className={clsx(
                          "w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                          iconClass
                        )}>
                          {icon}
                        </span>
                        <span className={clsx(
                          "text-sm font-medium",
                          textClass
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
            {showAnswer && question.explanation && (
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={16} className="text-indigo-600" />
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Explanation</span>
                </div>
                <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            )}

            {/* Related Lessons */}
            {question.lessons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 opacity-65">
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

          </div>
        </motion.div>

        {/* Footer Navigation */}
        <div className="px-3 py-2 flex items-center justify-between flex-shrink-0 border-t border-slate-100 opacity-65">
          <button
            onClick={onPrevious}
            disabled={isFirstQuestion}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onMarkStatus('needs_review')}
              className={clsx(
                "p-2 rounded-full transition-all",
                question.studyStatus?.status === 'needs_review'
                  ? "bg-amber-500 text-white"
                  : "text-amber-600 hover:bg-amber-50"
              )}
              aria-label="Review Later"
            >
              <RotateCcw size={20} />
            </button>

            <button
              onClick={onToggleBookmark}
              className={clsx(
                "p-2 rounded-full transition-colors",
                question.isBookmarked 
                  ? "bg-indigo-100 text-indigo-600" 
                  : "hover:bg-slate-100 text-slate-400"
              )}
              aria-label="Bookmark"
            >
              <Bookmark size={20} fill={question.isBookmarked ? 'currentColor' : 'none'} />
            </button>

            <button
              onClick={() => {
                onMarkStatus('mastered');
                if (!isLastQuestion) onNext();
              }}
              className={clsx(
                "p-2 rounded-full transition-all",
                question.studyStatus?.status === 'mastered'
                  ? "bg-emerald-500 text-white"
                  : "text-emerald-600 hover:bg-emerald-50"
              )}
              aria-label="Got It"
            >
              <Check size={20} />
            </button>
          </div>

          <button
            onClick={onNext}
            disabled={isLastQuestion}
            className={clsx(
              "p-2 rounded-full transition-all",
              isLastQuestion
                ? "text-slate-300 cursor-not-allowed"
                : "text-indigo-600 hover:bg-indigo-50"
            )}
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

