import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';

interface Choice {
  position: number;
  text: string;
  imageUrl: string | null;
}

interface Question {
  id: number;
  questionText: string;
  answerType: string;
  isMajorFault: boolean;
  choices: Choice[];
  imageUrl: string | null;
  answer?: any;
  explanation?: string | null;
}

interface QuestionCardProps {
  question: Question;
  selectedAnswer: any;
  onAnswer: (answer: any) => void;
  showFeedback?: boolean;
  // Header props
  user?: {
    avatarUrl?: string | null;
    displayName?: string | null;
  } | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeLeft: number;
  onExitClick: () => void;
  // Footer props
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  finishLabel?: string;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedAnswer,
  onAnswer,
  showFeedback = false,
  user,
  currentQuestionIndex,
  totalQuestions,
  timeLeft,
  onExitClick,
  onPrevious,
  onNext,
  onFinish,
  finishLabel = "Finish Exam",
  isFirstQuestion,
  isLastQuestion,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset image loaded state when question changes
  useEffect(() => {
    setImageLoaded(false);
  }, [question.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const isCorrect = React.useMemo(() => {
    if (selectedAnswer === undefined || selectedAnswer === null) return false;
    if (question.answer === undefined || question.answer === null) return false;
    
    // For INPUT type questions, compare as trimmed strings (handles number vs string mismatch)
    if (question.answerType === 'INPUT') {
      const submittedStr = String(selectedAnswer).trim();
      const correctStr = String(question.answer).trim();
      return submittedStr === correctStr;
    }
    
    // Deep comparison for arrays (ORDER) or strict comparison for choice-based questions
    return JSON.stringify(selectedAnswer) === JSON.stringify(question.answer);
  }, [selectedAnswer, question.answer, question.answerType]);

  return (
    <div className="w-full max-w-md md:max-w-lg lg:max-w-xl mx-auto h-full flex flex-col">
      <div
        className={clsx(
          "bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border-2 transition-colors flex flex-col h-full",
          showFeedback && selectedAnswer !== undefined
            ? isCorrect
              ? "border-emerald-500 shadow-emerald-100"
              : "border-rose-500 shadow-rose-100"
            : "border-slate-100"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 md:px-4 pt-3 md:pt-4 pb-2 md:pb-3 flex-shrink-0 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={onExitClick}
                className="hover:opacity-80 transition-opacity mr-1"
                aria-label="Go to homepage"
              >
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-slate-200 shadow-sm object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-slate-200 shadow-sm flex items-center justify-center">
                    <span className="text-xs md:text-sm font-bold text-white">
                      {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </button>
              <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Question</span>
              <span className="text-base md:text-lg font-black text-slate-900">{currentQuestionIndex + 1}</span>
              <span className="text-slate-300 font-bold">/</span>
              <span className="text-sm md:text-base font-bold text-slate-400">{totalQuestions}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Time</span>
              <span className={clsx(
                "text-sm md:text-base font-mono font-bold",
                timeLeft < 300 ? "text-rose-600" : "text-slate-700"
              )}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Animated Question Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {question.imageUrl && (
                <div className={clsx(
                  "w-full bg-slate-100 relative border-b border-slate-100 overflow-hidden transition-all duration-500 aspect-[16/10] flex-shrink-0",
                  showFeedback 
                    ? "max-h-[15vh] md:max-h-[20vh] lg:max-h-[25vh]" 
                    : "max-h-[25vh] md:max-h-[28vh] lg:max-h-[32vh]"
                )}>
                  {/* Loading skeleton */}
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-white flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                  )}
                  <img
                    src={question.imageUrl}
                    alt="Question scenario"
                    onLoad={() => setImageLoaded(true)}
                    className={clsx(
                      "w-full h-full object-contain bg-white transition-opacity duration-300",
                      imageLoaded ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {question.isMajorFault && (
                    <div className="absolute top-2 right-2 bg-rose-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg">
                      Major Fault
                    </div>
                  )}
                  
                  <AnimatePresence>
                    {showFeedback && selectedAnswer !== undefined && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={clsx(
                          "absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[2px]",
                          isCorrect ? "bg-emerald-500/10" : "bg-rose-500/10"
                        )}
                      >
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={clsx(
                            "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl",
                            isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                          )}
                        >
                          {isCorrect ? (
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex flex-col flex-1 min-h-0">
                {/* Question text - fixed, doesn't scroll */}
                <div className={clsx(
                  "px-3 md:px-4 lg:px-6 pt-3 md:pt-4 lg:pt-6 flex-shrink-0",
                  showFeedback && "lg:pt-4"
                )}>
                  <h2 className={clsx(
                    "font-bold text-slate-900 leading-tight",
                    showFeedback 
                      ? "text-sm md:text-base mb-2 md:mb-3" 
                      : "text-sm md:text-base lg:text-lg mb-2 md:mb-3 lg:mb-4"
                  )}>
                    {question.questionText}
                  </h2>
                </div>

                {/* Answers - scrollable when needed */}
                <div className="relative flex-1 min-h-0">
                  <div className="h-full overflow-y-auto overflow-x-hidden px-3 md:px-4 lg:px-6 pb-3 md:pb-4 lg:pb-6">
                    <div className={clsx(
                      "space-y-2 md:space-y-3",
                      showFeedback && "lg:space-y-2"
                    )}>
              {question.answerType === 'INPUT' ? (
                <div className="space-y-2 md:space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      inputMode="numeric"
                      value={selectedAnswer || ''}
                      onChange={(e) => !showFeedback && onAnswer(e.target.value)}
                      placeholder="Typ hier je antwoord..."
                      disabled={showFeedback}
                      className={clsx(
                        "w-full p-3 md:p-4 text-lg md:text-xl font-bold rounded-xl md:rounded-2xl border-2 md:border-4 transition-all text-center outline-none",
                        showFeedback
                          ? isCorrect
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-rose-500 bg-rose-50 text-rose-900"
                          : "border-slate-100 bg-slate-50 focus:border-indigo-600 focus:bg-white text-slate-900"
                      )}
                    />
                    {showFeedback && !isCorrect && (
                      <div className="mt-2 p-2 md:p-3 bg-emerald-100 rounded-lg border border-emerald-200 text-center">
                        <span className="text-emerald-800 font-bold uppercase text-[10px] tracking-wider block mb-1">Correct Antwoord</span>
                        <span className="text-emerald-900 text-base md:text-lg font-black">{question.answer}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : question.answerType === 'YES_NO' ? (
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {question.choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.position;
                    const isChoiceCorrect = question.answer === choice.position;

                    return (
                      <button
                        key={choice.position}
                        onClick={() => !showFeedback && onAnswer(choice.position)}
                        className={clsx(
                          "p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl text-center transition-all border-2 md:border-4 flex flex-col items-center justify-center gap-1",
                          isSelected
                            ? showFeedback
                              ? isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-rose-500 bg-rose-50 text-rose-900"
                              : "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-lg"
                            : showFeedback && isChoiceCorrect
                              ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                              : "border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700",
                          showFeedback && "cursor-default"
                        )}
                      >
                        <span className="text-base md:text-xl lg:text-2xl font-black">{choice.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : question.answerType === 'ORDER' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {question.choices.map((choice) => {
                      const orderIndex = (selectedAnswer as number[] || []).indexOf(choice.position);
                      const isSelected = orderIndex !== -1;
                      
                      return (
                        <button
                          key={choice.position}
                          onClick={() => {
                            if (showFeedback) return;
                            const currentOrder = selectedAnswer as number[] || [];
                            let newOrder;
                            if (isSelected) {
                              newOrder = currentOrder.filter(p => p !== choice.position);
                            } else {
                              newOrder = [...currentOrder, choice.position];
                            }
                            onAnswer(newOrder);
                          }}
                          className={clsx(
                            "relative w-24 h-24 md:w-28 md:h-28 rounded-xl border-2 md:border-4 transition-all overflow-hidden bg-white shadow-sm",
                            isSelected
                              ? "border-indigo-600 ring-2 md:ring-4 ring-indigo-100"
                              : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          {choice.imageUrl && (
                            <img src={choice.imageUrl} alt="" className="w-full h-full object-contain p-1 md:p-2" />
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                              <span className="bg-indigo-600 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-base md:text-xl font-black shadow-lg">
                                {orderIndex + 1}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {showFeedback && (
                    <div className="p-2 md:p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                      <span className="text-emerald-800 font-bold uppercase text-[10px] tracking-wider block mb-1 md:mb-2">Juiste Volgorde</span>
                      <div className="flex justify-center gap-2">
                        {(question.answer as number[]).map((pos, idx) => (
                          <div key={idx} className="w-7 h-7 md:w-8 md:h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-xs md:text-sm">
                            {pos + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Check if this is an image-based SINGLE_CHOICE question
                (() => {
                  const hasImageChoices = question.choices.some(c => c.imageUrl && !c.text);
                  
                  if (hasImageChoices) {
                    // Image-based SINGLE_CHOICE layout (grid of images)
                    return (
                      <div className="grid grid-cols-2 gap-2 md:gap-3">
                        {question.choices.map((choice) => {
                          const isSelected = selectedAnswer === choice.position;
                          const isChoiceCorrect = choice.position === question.answer;
                          
                          return (
                            <button
                              key={choice.position}
                              onClick={() => !showFeedback && onAnswer(choice.position)}
                              className={clsx(
                                "relative aspect-square rounded-lg md:rounded-xl border-2 md:border-4 transition-all overflow-hidden bg-white shadow-sm",
                                isSelected
                                  ? showFeedback
                                    ? isCorrect
                                      ? "border-emerald-500 ring-2 md:ring-4 ring-emerald-100"
                                      : "border-rose-500 ring-2 md:ring-4 ring-rose-100"
                                    : "border-indigo-600 ring-2 md:ring-4 ring-indigo-100"
                                  : showFeedback && isChoiceCorrect
                                    ? "border-emerald-500 ring-2 md:ring-4 ring-emerald-100"
                                    : "border-slate-100 hover:border-slate-200 hover:shadow-md",
                                showFeedback && "cursor-default"
                              )}
                            >
                              {/* Letter badge */}
                              <div className={clsx(
                                "absolute top-2 left-2 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center font-bold text-xs z-10 shadow-md transition-colors",
                                isSelected
                                  ? showFeedback
                                    ? isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                    : "bg-indigo-600 text-white"
                                  : showFeedback && isChoiceCorrect
                                    ? "bg-emerald-500 text-white"
                                    : "bg-white/90 backdrop-blur-sm text-slate-600 border border-slate-200"
                              )}>
                                {String.fromCharCode(65 + choice.position)}
                              </div>
                              
                              {/* Image or text fallback */}
                              {choice.imageUrl ? (
                                <img 
                                  src={choice.imageUrl} 
                                  alt={`Choice ${String.fromCharCode(65 + choice.position)}`}
                                  className="w-full h-full object-contain p-2 md:p-3"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-2 md:p-3">
                                  <span className="font-medium text-xs md:text-sm text-slate-700 text-center">{choice.text}</span>
                                </div>
                              )}
                              
                              {/* Feedback overlay */}
                              {showFeedback && (isSelected || isChoiceCorrect) && (
                                <div className={clsx(
                                  "absolute inset-0 flex items-center justify-center",
                                  isChoiceCorrect ? "bg-emerald-500/10" : "bg-rose-500/10"
                                )}>
                                  <div className={clsx(
                                    "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg",
                                    isChoiceCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                  )}>
                                    {isChoiceCorrect ? (
                                      <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  
                    // Standard text-based SINGLE_CHOICE layout (list)
                  return question.choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.position;
                    const isChoiceCorrect = choice.position === question.answer;
                    
                    return (
                      <button
                        key={choice.position}
                        onClick={() => !showFeedback && onAnswer(choice.position)}
                        className={clsx(
                          "w-full p-2 md:p-3 rounded-lg md:rounded-xl text-left transition-all border-2 flex items-center gap-2 md:gap-3 relative overflow-hidden",
                          isSelected
                            ? showFeedback
                              ? isCorrect
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                : "border-rose-500 bg-rose-50 text-rose-900"
                              : "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md"
                            : showFeedback && isChoiceCorrect
                              ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                              : "border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700",
                          showFeedback && "cursor-default"
                        )}
                      >
                        <span className={clsx(
                          "w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                          isSelected
                            ? showFeedback
                              ? isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                              : "bg-indigo-600 text-white"
                            : showFeedback && isChoiceCorrect
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-500"
                        )}>
                          {String.fromCharCode(65 + choice.position)}
                        </span>
                        <span className="text-xs md:text-sm font-medium">{choice.text}</span>
                        
                        {showFeedback && (isSelected || isChoiceCorrect) && (
                          <div className="ml-auto">
                            <div className={clsx(
                              "w-3 h-3 rounded-full animate-pulse",
                              isChoiceCorrect ? "bg-emerald-500" : "bg-rose-500"
                            )} />
                          </div>
                        )}
                      </button>
                    );
                  });
                })()
              )}

              {showFeedback && question.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 md:p-5 bg-indigo-50 rounded-xl md:rounded-2xl border border-indigo-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs md:text-sm font-black text-indigo-900 uppercase tracking-wider">Uitleg</span>
                  </div>
                  <p className="text-sm md:text-base text-indigo-900 font-medium leading-relaxed">
                    {question.explanation}
                  </p>
                </motion.div>
              )}
                    </div>
                  </div>
                  {/* Gradient fade indicator for scrollable content */}
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className="px-3 py-2 flex items-center justify-between flex-shrink-0 border-t border-slate-100">
            <button
              onClick={onPrevious}
              disabled={isFirstQuestion}
              className="p-2 rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={isLastQuestion ? onFinish : onNext}
              className={clsx(
                "p-2 rounded-full transition-all",
                isLastQuestion
                  ? "text-emerald-600 hover:bg-emerald-50"
                  : "text-indigo-600 hover:bg-indigo-50"
              )}
              aria-label={isLastQuestion ? finishLabel : "Next"}
            >
              {isLastQuestion ? (
                <Flag size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </button>
          </div>
      </div>
    </div>
  );
};

