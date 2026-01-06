import { setup, assign } from 'xstate';

interface Question {
  id: number;
  questionText: string;
  answerType: string;
  isMajorFault: boolean;
  choices: Array<{ position: number; text: string; imageUrl: string | null }>;
  imageUrl: string | null;
  category: { slug: string; title: string };
  answer?: any;
  explanation?: string | null;
}

interface ExamContext {
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<number, any>;
  timeLeft: number; // in seconds
  results: any | null;
}

export const examMachine = setup({
  types: {} as {
    context: ExamContext;
    events:
      | { type: 'START_EXAM'; questions: Question[]; timeLimit: number }
      | { type: 'SUBMIT_ANSWER'; questionId: number; answer: any }
      | { type: 'NEXT_QUESTION' }
      | { type: 'PREV_QUESTION' }
      | { type: 'FINISH_EXAM' }
      | { type: 'TICK' }
      | { type: 'SUBMIT_EXAM' }
      | { type: 'REVIEW_RESULTS' }
      | { type: 'BACK_TO_SUMMARY' }
      | { type: 'REPORT.SUCCESS'; data: any }
      | { type: 'REPORT.FAILURE'; error: any };
  },
}).createMachine({
  id: 'exam',
  initial: 'idle',
  context: {
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    timeLeft: 0,
    results: null,
  },
  states: {
    idle: {
      on: {
        START_EXAM: {
          target: 'answering',
          actions: assign({
            questions: ({ event }) => event.questions,
            timeLeft: ({ event }) => event.timeLimit * 60,
            currentQuestionIndex: 0,
            answers: {},
            results: null,
          }),
        },
      },
    },
    answering: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.timeLeft <= 0,
            target: 'reviewing',
          },
          {
            actions: assign({
              timeLeft: ({ context }) => Math.max(0, context.timeLeft - 1),
            }),
          },
        ],
        SUBMIT_ANSWER: {
          actions: assign({
            answers: ({ context, event }) => ({
              ...context.answers,
              [event.questionId]: event.answer,
            }),
          }),
        },
        NEXT_QUESTION: {
          actions: assign({
            currentQuestionIndex: ({ context }) =>
              Math.min(context.currentQuestionIndex + 1, context.questions.length - 1),
          }),
        },
        PREV_QUESTION: {
          actions: assign({
            currentQuestionIndex: ({ context }) =>
              Math.max(context.currentQuestionIndex - 1, 0),
          }),
        },
        FINISH_EXAM: 'reviewing',
      },
    },
    reviewing: {
      on: {
        SUBMIT_EXAM: 'submitting',
        PREV_QUESTION: 'answering',
      },
    },
    submitting: {
      // API call to score will be handled in the component for now
      on: {
        'REPORT.SUCCESS': {
          target: 'completed',
          actions: assign({ results: ({ event }: any) => event.data }),
        },
        'REPORT.FAILURE': 'answering',
      },
    },
    completed: {
      on: {
        REVIEW_RESULTS: {
          target: 'reviewing_results',
          actions: assign({ currentQuestionIndex: 0 }),
        },
      },
    },
    reviewing_results: {
      on: {
        NEXT_QUESTION: {
          actions: assign({
            currentQuestionIndex: ({ context }) =>
              Math.min(context.currentQuestionIndex + 1, context.questions.length - 1),
          }),
        },
        PREV_QUESTION: {
          actions: assign({
            currentQuestionIndex: ({ context }) =>
              Math.max(context.currentQuestionIndex - 1, 0),
          }),
        },
        BACK_TO_SUMMARY: 'completed',
      },
    },
  },
});

