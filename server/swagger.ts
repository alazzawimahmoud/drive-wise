import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DriveWise API',
      version: '1.0.0',
      description: 'Belgian driving license theory questions API',
      contact: {
        name: 'DriveWise',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
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

