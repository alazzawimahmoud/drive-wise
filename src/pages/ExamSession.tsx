import { useEffect, useRef, useState } from 'react';
import { useMachine } from '@xstate/react';
import { examMachine } from '../store/examMachine';
import { QuestionCard } from '../components/QuestionCard';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import api from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { EXAM_SHORTCUTS } from '../hooks/useQuestionKeyboard';

interface ExamResult {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  majorFaults: number;
  minorFaults: number;
  score: number;
  maxScore: number;
  passed: boolean;
  passThreshold: number;
  percentage: number;
}

export const ExamSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const startTimeRef = useRef<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<ExamResult | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { data: examData, isLoading: isExamLoading } = useQuery({
    queryKey: ['exam-generate'],
    queryFn: async () => {
      const res = await api.post('/exam/generate', { locale: 'nl-BE' });
      return res.data;
    },
  });

  const [state, send] = useMachine(examMachine);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (examData && state.matches('idle')) {
      startTimeRef.current = new Date();
      send({ 
        type: 'START_EXAM', 
        questions: examData.questions, 
        timeLimit: examData.config.timeLimitMinutes 
      });
    }
  }, [examData, state, send]);

  // Dev mode: auto-answer all questions with correct answers
  useEffect(() => {
    if (import.meta.env.DEV && state.matches('answering') && examData?.questions) {
      // Auto-submit answers for all questions that have answers included
      examData.questions.forEach((q: any) => {
        if (q.answer !== undefined) {
          send({ type: 'SUBMIT_ANSWER', questionId: q.id, answer: q.answer });
        }
      });
    }
  }, [state.value, examData, send]);

  useEffect(() => {
    if (state.matches('answering')) {
      const timer = setInterval(() => {
        send({ type: 'TICK' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, send]);

  const handleSubmitExam = async () => {
    setIsSubmitting(true);
    send({ type: 'SUBMIT_EXAM' });

    const { questions, answers, timeLeft } = state.context;
    const timeLimitSeconds = examData?.config.timeLimitMinutes * 60 || 0;
    const timeTakenSeconds = timeLimitSeconds - timeLeft;

    try {
      const answersPayload = questions.map((q: any) => ({
        questionId: q.id,
        answer: answers[q.id] ?? null,
      }));

      const res = await api.post('/exam/score', {
        answers: answersPayload,
        sessionType: 'exam',
        startedAt: startTimeRef.current.toISOString(),
        timeTakenSeconds,
      });

      setResults(res.data.result);
      send({ type: 'REPORT.SUCCESS', data: res.data });
    } catch (error) {
      console.error('Failed to submit exam:', error);
      send({ type: 'REPORT.FAILURE', error });
      setIsSubmitting(false);
    }
  };

  if (isExamLoading || state.matches('idle')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Preparing your exam...</p>
        </div>
      </div>
    );
  }

  const { questions, currentQuestionIndex, answers, timeLeft } = state.context;
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[parseInt(k)] !== undefined).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full p-2 md:p-4 lg:p-6">
        {/* Unified Layout Container */}
        <div className="flex-1 min-h-0 flex flex-col">
          {state.matches('answering') || state.matches('reviewing_results') ? (
            <QuestionCard
              question={
                state.matches('reviewing_results')
                  ? {
                      ...currentQuestion,
                      answer: state.context.results?.details?.find((d: any) => d.questionId === currentQuestion.id)?.correct,
                      explanation: state.context.results?.details?.find((d: any) => d.questionId === currentQuestion.id)?.explanation,
                    }
                  : currentQuestion
              }
              selectedAnswer={answers[currentQuestion.id]}
              onAnswer={(answer) => !state.matches('reviewing_results') && send({ type: 'SUBMIT_ANSWER', questionId: currentQuestion.id, answer })}
              showFeedback={state.matches('reviewing_results')}
              user={user}
              currentQuestionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              timeLeft={state.matches('reviewing_results') ? 0 : timeLeft}
              onExitClick={() => setShowExitModal(true)}
              onPrevious={() => send({ type: 'PREV_QUESTION' })}
              onNext={() => send({ type: 'NEXT_QUESTION' })}
              onFinish={() => {
                if (state.matches('reviewing_results')) {
                  send({ type: 'BACK_TO_SUMMARY' });
                } else {
                  send({ type: 'FINISH_EXAM' });
                }
              }}
              finishLabel={state.matches('reviewing_results') ? "Back to Summary" : "Finish Exam"}
              isFirstQuestion={currentQuestionIndex === 0}
              isLastQuestion={currentQuestionIndex === questions.length - 1}
              onToggleHelp={() => setShowShortcuts(prev => !prev)}
              onBackToSummary={state.matches('reviewing_results') ? () => send({ type: 'BACK_TO_SUMMARY' }) : undefined}
            />
          ) : (
            <div className="w-full max-w-md md:max-w-lg lg:max-w-xl mx-auto h-full flex flex-col">
              <div className={clsx(
                "bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border-2 transition-colors flex flex-col h-full",
                state.matches('completed') && results
                  ? results.passed
                    ? "border-emerald-500 shadow-emerald-100"
                    : "border-rose-500 shadow-rose-100"
                  : "border-slate-100"
              )}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 md:px-4 pt-3 md:pt-4 pb-2 md:pb-3 flex-shrink-0 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowExitModal(true)}
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
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {state.matches('completed') ? 'Results' : 'Review'}
                    </span>
                    <span className="text-base md:text-lg font-black text-slate-900">
                      {state.matches('completed') ? 'Exam Summary' : 'Your Progress'}
                    </span>
                  </div>

                  {!state.matches('completed') && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Time</span>
                      <span className={clsx(
                        "text-sm md:text-base font-mono font-bold",
                        timeLeft < 300 ? "text-rose-600" : "text-slate-700"
                      )}>
                        {formatTime(timeLeft)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                  {state.matches('completed') && results ? (
                    <div className="text-center">
                      <div className={clsx(
                        "w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6",
                        results.passed ? "bg-emerald-100" : "bg-rose-100"
                      )}>
                        {results.passed ? (
                          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-10 h-10 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>

                      <h1 className={clsx(
                        "text-2xl md:text-3xl font-black mb-2",
                        results.passed ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {results.passed ? 'Congratulations!' : 'Not Quite There'}
                      </h1>
                      <p className="text-slate-500 mb-8">
                        {results.passed 
                          ? 'You passed the exam!' 
                          : 'Keep practicing and try again.'}
                      </p>

                      {/* Points - Hero Metric */}
                      <div className={clsx(
                        "rounded-2xl p-6 mb-4",
                        results.passed ? "bg-emerald-50" : "bg-rose-50"
                      )}>
                        <div className={clsx(
                          "text-5xl md:text-6xl font-black mb-1",
                          results.passed ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {results.score}<span className="text-2xl md:text-3xl text-slate-400">/{results.maxScore}</span>
                        </div>
                        <div className="text-sm text-slate-500 font-medium">
                          Points · {results.passThreshold} needed to pass
                        </div>
                      </div>

                      {/* Faults breakdown - only show if there are any */}
                      {(results.minorFaults > 0 || results.majorFaults > 0) && (
                        <div className="flex justify-center gap-4 mb-8 text-sm">
                          {results.minorFaults > 0 && (
                            <span className="text-amber-600 font-semibold">
                              {results.minorFaults} minor fault{results.minorFaults !== 1 ? 's' : ''}
                            </span>
                          )}
                          {results.majorFaults > 0 && (
                            <span className="text-rose-600 font-semibold">
                              {results.majorFaults} major fault{results.majorFaults !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {results.minorFaults === 0 && results.majorFaults === 0 && <div className="mb-8" />}

                      <button
                        onClick={() => send({ type: 'REVIEW_RESULTS' })}
                        className="w-full p-3 md:p-4 bg-white border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 rounded-2xl flex items-center gap-3 md:gap-4 transition-all group mb-4"
                      >
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="text-left flex-1">
                          <div className="text-sm md:text-base font-black text-slate-900">Review Questions</div>
                          <div className="text-xs md:text-sm font-bold text-slate-500">Learn from your mistakes</div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-100 transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>

                      {/* Major Faults List */}
                      {(() => {
                        const majorFaultDetails = state.context.results?.details?.filter(
                          (d: any) => !d.isCorrect && d.isMajorFault
                        ) || [];
                        
                        if (majorFaultDetails.length === 0) return null;
                        
                        return (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-rose-600 uppercase tracking-wider px-1">
                              Major Faults
                            </div>
                            {majorFaultDetails.map((detail: any) => {
                              const questionIndex = questions.findIndex((q: any) => q.id === detail.questionId);
                              return (
                                <button
                                  key={detail.questionId}
                                  onClick={() => send({ type: 'REVIEW_RESULTS', startIndex: questionIndex })}
                                  className="w-full p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-left transition-all group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center font-bold text-sm shrink-0">
                                      {questionIndex + 1}
                                    </div>
                                    <p className="text-sm text-rose-900 font-medium line-clamp-2 flex-1">
                                      {detail.questionText}
                                    </p>
                                    <svg className="w-4 h-4 text-rose-400 group-hover:text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (state.matches('reviewing') || state.matches('submitting')) && (
                    <>
                      <h1 className="text-2xl font-black text-slate-900 mb-2 text-center">Review Your Exam</h1>
                      <p className="text-slate-500 text-center mb-8">
                        Make sure you've answered all questions before submitting.
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                          <div className="text-3xl font-black text-emerald-600">{answeredCount}</div>
                          <div className="text-sm text-emerald-600 font-medium">Answered</div>
                        </div>
                        <div className={clsx(
                          "rounded-2xl p-4 text-center",
                          unansweredCount > 0 ? "bg-amber-50" : "bg-slate-50"
                        )}>
                          <div className={clsx(
                            "text-3xl font-black",
                            unansweredCount > 0 ? "text-amber-600" : "text-slate-400"
                          )}>{unansweredCount}</div>
                          <div className={clsx(
                            "text-sm font-medium",
                            unansweredCount > 0 ? "text-amber-600" : "text-slate-400"
                          )}>Unanswered</div>
                        </div>
                      </div>

                      {unansweredCount > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                          <p className="text-amber-800 text-sm font-medium">
                            ⚠️ You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. 
                            Unanswered questions will be marked as incorrect.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer Navigation */}
                <div className="px-3 md:px-4 pt-2 md:pt-3 pb-3 md:pb-4 flex items-center justify-between flex-shrink-0 border-t border-slate-100">
                  {state.matches('completed') ? (
                    <>
                      <button
                        onClick={() => navigate('/')}
                        className="px-4 md:px-5 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-all"
                      >
                        Back to Dashboard
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-5 md:px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 transition-all"
                      >
                        Try Again
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => send({ type: 'PREV_QUESTION' })}
                        disabled={isSubmitting}
                        className="px-4 md:px-5 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        Go Back
                      </button>
                      <button
                        onClick={handleSubmitExam}
                        disabled={isSubmitting}
                        className="px-5 md:px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Submitting...
                          </>
                        ) : (
                          'Submit Exam'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <h2 className="text-xl md:text-2xl font-black text-slate-900 text-center mb-2">
                  Exit Exam?
                </h2>
                
                <p className="text-slate-600 text-center mb-6 text-sm md:text-base">
                  Are you sure you want to exit the exam? Your progress will not be saved.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowExitModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-sm md:text-base"
                  >
                    Continue Exam
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-200 transition-all text-sm md:text-base"
                  >
                    Exit to Homepage
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={EXAM_SHORTCUTS}
      />
    </div>
  );
};

