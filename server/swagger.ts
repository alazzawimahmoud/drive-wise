import swaggerJsdoc from 'swagger-jsdoc';

const isProduction = process.env.NODE_ENV === 'production';
const productionUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL;

const servers = isProduction && productionUrl
  ? [{ url: productionUrl, description: 'Production server' }]
  : [{ url: 'http://localhost:3000', description: 'Development server' }];

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DriveWise API',
      version: '1.0.0',
      description: 'Belgian driving license theory questions API with user authentication, progress tracking, and analytics',
      contact: {
        name: 'DriveWise',
      },
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from OAuth authentication',
        },
      },
      schemas: {
        Locale: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'nl-BE' },
            name: { type: 'string', example: 'Nederlands (België)' },
            isDefault: { type: 'boolean', example: true },
          },
        },
        Region: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            code: { type: 'string', enum: ['national', 'brussels', 'flanders', 'wallonia'] },
            name: { type: 'string', example: 'Nationaal' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            slug: { type: 'string', example: 'verkeersborden' },
            sortOrder: { type: 'integer', example: 0 },
            title: { type: 'string', example: 'Verkeersborden' },
            description: { type: 'string', nullable: true },
          },
        },
        Lesson: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 12 },
            number: { type: 'integer', example: 12 },
            slug: { type: 'string', example: 'les-12' },
            title: { type: 'string', example: 'De snelheid' },
            description: { type: 'string', nullable: true },
            questionCount: { type: 'integer', example: 124 },
          },
        },
        Choice: {
          type: 'object',
          properties: {
            position: { type: 'integer', example: 0 },
            text: { type: 'string', nullable: true, example: 'A. 50 km/uur' },
            imageUrl: { type: 'string', nullable: true },
          },
        },
        Question: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            originalId: { type: 'string', example: '2854' },
            answerType: { 
              type: 'string', 
              enum: ['SINGLE_CHOICE', 'YES_NO', 'INPUT', 'ORDER'] 
            },
            answer: { 
              oneOf: [
                { type: 'integer' },
                { type: 'string' },
                { type: 'array', items: { type: 'integer' } }
              ],
              example: 0 
            },
            isMajorFault: { type: 'boolean', example: false },
            questionText: { type: 'string', example: 'Wat is de maximum snelheid?' },
            explanation: { type: 'string', nullable: true },
            category: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                title: { type: 'string' },
              },
            },
            region: {
              type: 'object',
              nullable: true,
              properties: {
                code: { type: 'string' },
                name: { type: 'string' },
              },
            },
            imageUrl: { type: 'string', nullable: true },
            choices: {
              type: 'array',
              items: { $ref: '#/components/schemas/Choice' },
            },
            lessons: {
              type: 'array',
              items: { $ref: '#/components/schemas/QuestionLesson' },
            },
          },
        },
        QuestionLesson: {
          type: 'object',
          properties: {
            number: { type: 'integer', example: 12 },
            slug: { type: 'string', example: 'les-12' },
            title: { type: 'string', nullable: true, example: 'De snelheid' },
          },
        },
        ExamConfig: {
          type: 'object',
          properties: {
            totalQuestions: { type: 'integer', example: 50 },
            passThreshold: { type: 'integer', example: 41 },
            majorFaultPenalty: { type: 'integer', example: 5 },
            minorFaultPenalty: { type: 'integer', example: 1 },
            maxScore: { type: 'integer', example: 50 },
            timeLimitMinutes: { type: 'integer', example: 90 },
          },
        },
        ExamResult: {
          type: 'object',
          properties: {
            totalQuestions: { type: 'integer' },
            correct: { type: 'integer' },
            incorrect: { type: 'integer' },
            majorFaults: { type: 'integer' },
            minorFaults: { type: 'integer' },
            score: { type: 'integer' },
            maxScore: { type: 'integer' },
            passed: { type: 'boolean' },
            passThreshold: { type: 'integer' },
            percentage: { type: 'integer' },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string', example: '1.0.0' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', format: 'email', nullable: true, example: 'user@example.com' },
            displayName: { type: 'string', example: 'John Doe' },
            avatarUrl: { type: 'string', nullable: true, example: 'https://example.com/avatar.jpg' },
            preferredLocale: { type: 'string', enum: ['nl-BE', 'fr-BE', 'de-BE', 'en'], example: 'nl-BE' },
            preferredRegion: { type: 'string', enum: ['national', 'brussels', 'flanders', 'wallonia'], nullable: true },
            providers: { type: 'array', items: { type: 'string' }, example: ['google'], description: 'Linked OAuth providers' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Bookmark: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            bookmarkType: { type: 'string', enum: ['saved', 'difficult', 'review'] },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            question: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                originalId: { type: 'string' },
                answerType: { type: 'string' },
                isMajorFault: { type: 'boolean' },
                questionText: { type: 'string' },
                category: {
                  type: 'object',
                  properties: {
                    slug: { type: 'string' },
                    title: { type: 'string' },
                  },
                },
                imageUrl: { type: 'string', nullable: true },
              },
            },
          },
        },
        ExamSession: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            sessionType: { type: 'string', enum: ['exam', 'practice', 'review'] },
            totalQuestions: { type: 'integer' },
            correctAnswers: { type: 'integer' },
            incorrectAnswers: { type: 'integer' },
            majorFaults: { type: 'integer' },
            minorFaults: { type: 'integer' },
            score: { type: 'integer' },
            maxScore: { type: 'integer' },
            passed: { type: 'boolean' },
            percentage: { type: 'integer' },
            timeTakenSeconds: { type: 'integer', nullable: true },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        StatsOverview: {
          type: 'object',
          properties: {
            totalSessions: { type: 'integer' },
            passedSessions: { type: 'integer' },
            passRate: { type: 'integer', description: 'Percentage of exams passed' },
            averageScore: { type: 'number' },
            averagePercentage: { type: 'integer' },
            totalQuestionsAnswered: { type: 'integer' },
            totalCorrect: { type: 'integer' },
            totalIncorrect: { type: 'integer' },
            overallAccuracy: { type: 'integer', description: 'Overall accuracy percentage' },
            totalMajorFaults: { type: 'integer' },
            bestScore: { type: 'integer' },
            worstScore: { type: 'integer' },
            licenseProbability: { type: 'integer', description: 'Estimated probability of passing real exam (0-100)' },
            currentStreak: { type: 'integer', description: 'Consecutive passed exams' },
            improvement: { type: 'integer', nullable: true, description: 'Percentage point improvement in recent exams' },
            recentTrend: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  score: { type: 'integer' },
                  percentage: { type: 'integer' },
                  passed: { type: 'boolean' },
                  completedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        CategoryStats: {
          type: 'object',
          properties: {
            categoryId: { type: 'integer' },
            slug: { type: 'string' },
            title: { type: 'string' },
            totalAnswered: { type: 'integer' },
            correctAnswers: { type: 'integer' },
            incorrectAnswers: { type: 'integer' },
            accuracy: { type: 'integer', description: 'Accuracy percentage' },
            majorFaults: { type: 'integer' },
          },
        },
      },
      parameters: {
        locale: {
          name: 'locale',
          in: 'query',
          description: 'Locale code for translations',
          schema: {
            type: 'string',
            enum: ['nl-BE', 'fr-BE', 'de-BE', 'en'],
            default: 'nl-BE',
          },
        },
      },
    },
  },
  apis: ['./server/routes/*.ts', './server/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

