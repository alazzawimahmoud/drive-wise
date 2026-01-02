import { useEffect, useRef, useState } from 'react';
import { useMachine } from '@xstate/react';
import { examMachine } from '../store/examMachine';
import { QuestionCard } from '../components/QuestionCard';
import api from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';

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
  const startTimeRef = useRef<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<ExamResult | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  const { data: examData, isLoading: isExamLoading } = useQuery({
    queryKey: ['exam-generate'],
    queryFn: async () => {
      const res = await api.post('/exam/generate', { locale: 'nl-BE' });
      return res.data;
    },
  });

  const [state, send] = useMachine(examMachine);

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
      send({ type: 'REPORT.SUCCESS', data: res.data.result });
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

  // Results screen
  if (state.matches('completed') && results) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center">
            <div className={clsx(
              "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6",
              results.passed ? "bg-emerald-100" : "bg-rose-100"
            )}>
              {results.passed ? (
                <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-12 h-12 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <h1 className={clsx(
              "text-3xl font-black mb-2",
              results.passed ? "text-emerald-600" : "text-rose-600"
            )}>
              {results.passed ? 'Congratulations!' : 'Not Quite There'}
            </h1>
            <p className="text-slate-500 mb-8">
              {results.passed 
                ? 'You passed the exam!' 
                : 'Keep practicing and try again.'}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-3xl font-black text-slate-900">{results.percentage}%</div>
                <div className="text-sm text-slate-500 font-medium">Score</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-3xl font-black text-slate-900">{results.correct}/{results.totalQuestions}</div>
                <div className="text-sm text-slate-500 font-medium">Correct</div>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4">
                <div className="text-3xl font-black text-amber-600">{results.minorFaults}</div>
                <div className="text-sm text-amber-600 font-medium">Minor Faults</div>
              </div>
              <div className="bg-rose-50 rounded-2xl p-4">
                <div className="text-3xl font-black text-rose-600">{results.majorFaults}</div>
                <div className="text-sm text-rose-600 font-medium">Major Faults</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Review screen before submitting
  if (state.matches('reviewing') || state.matches('submitting')) {
    const { questions, answers } = state.context;
    const answeredCount = Object.keys(answers).filter(k => answers[parseInt(k)] !== undefined).length;
    const unansweredCount = questions.length - answeredCount;

    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
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

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => send({ type: 'PREV_QUESTION' })}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-all"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Exam'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { questions, currentQuestionIndex, answers, timeLeft } = state.context;
  const currentQuestion = questions[currentQuestionIndex];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3 md:mb-6 px-2 md:px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExitModal(true)}
              className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"
              aria-label="Go to homepage"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question</span>
            <span className="text-lg md:text-xl font-black text-slate-900">{currentQuestionIndex + 1}</span>
            <span className="text-slate-300 font-bold">/</span>
            <span className="text-base md:text-lg font-bold text-slate-400">{questions.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time</span>
            <span className={clsx(
              "text-base md:text-lg font-mono font-bold",
              timeLeft < 300 ? "text-rose-600" : "text-slate-700"
            )}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        <QuestionCard
          question={currentQuestion}
          selectedAnswer={answers[currentQuestion.id]}
          onAnswer={(answer) => send({ type: 'SUBMIT_ANSWER', questionId: currentQuestion.id, answer })}
        />

        <div className="mt-3 md:mt-8 flex items-center justify-between px-2 md:px-4">
          <button
            onClick={() => send({ type: 'PREV_QUESTION' })}
            disabled={currentQuestionIndex === 0}
            className="px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-all"
          >
            Previous
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={() => send({ type: 'FINISH_EXAM' })}
              className="px-5 md:px-8 py-2 md:py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg md:rounded-xl text-sm md:text-base font-bold shadow-lg shadow-emerald-200 transition-all"
            >
              Finish Exam
            </button>
          ) : (
            <button
              onClick={() => send({ type: 'NEXT_QUESTION' })}
              className="px-5 md:px-8 py-2 md:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg md:rounded-xl text-sm md:text-base font-bold shadow-lg shadow-indigo-200 transition-all"
            >
              Next Question
            </button>
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
    </div>
  );
};

