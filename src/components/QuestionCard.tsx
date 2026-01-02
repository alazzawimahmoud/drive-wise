import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

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
}

interface QuestionCardProps {
  question: Question;
  selectedAnswer: any;
  onAnswer: (answer: any) => void;
  showFeedback?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedAnswer,
  onAnswer,
  showFeedback = false,
}) => {
  const isCorrect = React.useMemo(() => {
    if (selectedAnswer === undefined || selectedAnswer === null) return false;
    if (question.answer === undefined || question.answer === null) return false;
    
    // Deep comparison for arrays (ORDER) or loose comparison for strings/numbers
    return JSON.stringify(selectedAnswer) === JSON.stringify(question.answer);
  }, [selectedAnswer, question.answer]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className={clsx(
            "bg-white rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border-2 transition-colors",
            showFeedback && selectedAnswer !== undefined
              ? isCorrect
                ? "border-emerald-500 shadow-emerald-100"
                : "border-rose-500 shadow-rose-100"
              : "border-slate-100"
          )}
        >
          {question.imageUrl && (
            <div className="aspect-[9/7] w-full bg-slate-100 relative">
              <img
                src={question.imageUrl}
                alt="Question scenario"
                className="w-full h-full object-cover"
              />
              {question.isMajorFault && (
                <div className="absolute top-2 md:top-4 right-2 md:right-4 bg-rose-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider shadow-lg">
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
                        "w-20 h-20 rounded-full flex items-center justify-center shadow-2xl",
                        isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                      )}
                    >
                      {isCorrect ? (
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="p-3 md:p-8">
            <h2 className="text-base md:text-xl font-bold text-slate-900 mb-3 md:mb-8 leading-tight">
              {question.questionText}
            </h2>

            <div className="space-y-2 md:space-y-4">
              {question.answerType === 'INPUT' ? (
                <div className="space-y-4">
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
                        "w-full p-4 md:p-6 text-xl md:text-2xl font-bold rounded-2xl border-4 transition-all text-center outline-none",
                        showFeedback
                          ? isCorrect
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-rose-500 bg-rose-50 text-rose-900"
                          : "border-slate-100 bg-slate-50 focus:border-indigo-600 focus:bg-white text-slate-900"
                      )}
                    />
                    {showFeedback && !isCorrect && (
                      <div className="mt-2 md:mt-4 p-3 md:p-4 bg-emerald-100 rounded-lg md:rounded-xl border border-emerald-200 text-center">
                        <span className="text-emerald-800 font-bold uppercase text-[10px] md:text-xs tracking-wider block mb-1">Correct Antwoord</span>
                        <span className="text-emerald-900 text-lg md:text-xl font-black">{question.answer}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : question.answerType === 'YES_NO' ? (
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {question.choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.position;
                    const isChoiceCorrect = question.answer === choice.position;

                    return (
                      <button
                        key={choice.position}
                        onClick={() => !showFeedback && onAnswer(choice.position)}
                        className={clsx(
                          "p-3 md:p-8 rounded-2xl md:rounded-3xl text-center transition-all border-4 flex flex-col items-center justify-center gap-1 md:gap-3",
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
                        <span className="text-lg md:text-3xl font-black">{choice.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : question.answerType === 'ORDER' ? (
                <div className="space-y-2 md:space-y-4">
                  <div className="flex flex-wrap gap-2 md:gap-4 justify-center">
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
                            "relative w-32 h-32 rounded-2xl border-4 transition-all overflow-hidden bg-white shadow-sm",
                            isSelected
                              ? "border-indigo-600 ring-4 ring-indigo-100"
                              : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          {choice.imageUrl && (
                            <img src={choice.imageUrl} alt="" className="w-full h-full object-contain p-2" />
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                              <span className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl font-black shadow-lg">
                                {orderIndex + 1}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {showFeedback && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                      <span className="text-emerald-800 font-bold uppercase text-xs tracking-wider block mb-2">Juiste Volgorde</span>
                      <div className="flex justify-center gap-2">
                        {(question.answer as number[]).map((pos, idx) => (
                          <div key={idx} className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-sm">
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
                      <div className="grid grid-cols-2 gap-2 md:gap-4">
                        {question.choices.map((choice) => {
                          const isSelected = selectedAnswer === choice.position;
                          const isChoiceCorrect = choice.position === question.answer;
                          
                          return (
                            <button
                              key={choice.position}
                              onClick={() => !showFeedback && onAnswer(choice.position)}
                              className={clsx(
                                "relative aspect-square rounded-xl md:rounded-2xl border-4 transition-all overflow-hidden bg-white shadow-sm",
                                isSelected
                                  ? showFeedback
                                    ? isCorrect
                                      ? "border-emerald-500 ring-4 ring-emerald-100"
                                      : "border-rose-500 ring-4 ring-rose-100"
                                    : "border-indigo-600 ring-4 ring-indigo-100"
                                  : showFeedback && isChoiceCorrect
                                    ? "border-emerald-500 ring-4 ring-emerald-100"
                                    : "border-slate-100 hover:border-slate-200 hover:shadow-md",
                                showFeedback && "cursor-default"
                              )}
                            >
                              {/* Letter badge */}
                              <div className={clsx(
                                "absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md transition-colors",
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
                                  className="w-full h-full object-contain p-4"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                  <span className="font-medium text-slate-700 text-center">{choice.text}</span>
                                </div>
                              )}
                              
                              {/* Feedback overlay */}
                              {showFeedback && (isSelected || isChoiceCorrect) && (
                                <div className={clsx(
                                  "absolute inset-0 flex items-center justify-center",
                                  isChoiceCorrect ? "bg-emerald-500/10" : "bg-rose-500/10"
                                )}>
                                  <div className={clsx(
                                    "w-12 h-12 rounded-full flex items-center justify-center shadow-lg",
                                    isChoiceCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                  )}>
                                    {isChoiceCorrect ? (
                                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          "w-full p-2.5 md:p-4 rounded-xl md:rounded-2xl text-left transition-all border-2 flex items-center gap-2 md:gap-4 relative overflow-hidden",
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
                          "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shrink-0 transition-colors",
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
                        <span className="text-sm md:text-base font-medium">{choice.text}</span>
                        
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
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

