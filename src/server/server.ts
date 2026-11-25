import express, { type Request, type Response } from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { registerAuthenticationRoutes } from './services/autheticationService.ts';
import { registerCategoriesRoutes } from './services/categoriesService.ts';
import { registerTransactionsRoutes } from './services/transactionsService.ts';
import { registerInvestmentsRoutes } from './services/investmentsService.ts';
import { registerDashboardRoutes } from './services/dashboardService.ts';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ==================== ROOT ROUTE ====================

/**
 * GET /
 * API welcome message
 */

const data = {
    message: 'Budget-Wallet API',
    version: '0.0.0',
    authentication: {
      note: 'Most endpoints require authentication. Include JWT token in Authorization header: Bearer <token>',
      endpoints: {
      }
    },
    endpoints: {
      dashboard: {
        'GET /api/dashboard?month=YYYY-MM': 'Get the authenticated user monthly summary, six-month trend, expense categories and recent transactions',
      },
      auth: {
        'POST /api/auth/signup': 'Create a new user account (Body: { name: string, email: string, username: string, password: string, confirmPassword: string })',
        'POST /api/auth/signin': 'Authenticate with { identifier, password }; returns a JWT on success',
        'POST /api/auth/recover': 'Reset a password using { identifier, newPassword, confirmPassword }'
      },
      categories: {
        'GET /api/categories': 'Get categories for the authenticated user (Authorization: Bearer <token>)',
        'POST /api/categories': 'Create a category for the authenticated user (Authorization: Bearer <token>)',
        'PATCH /api/categories/:id': 'Update a custom category owned by the authenticated user (Authorization: Bearer <token>)',
        'GET /api/categories/:id/deletion-status': 'Check whether a category can be deleted',
        'DELETE /api/categories/:id': 'Delete an unused custom category',
      },
      transactions: {
        'GET /api/transactions?month=YYYY-MM': 'Get authenticated user transactions and totals for a month',
        'POST /api/transactions': 'Create an income or expense for the authenticated user (Body: { type, categoryId, amountCents, dateTimestamp, label?, description? })',
        'PATCH /api/transactions/:id': 'Update an authenticated user transaction (Body: { type?, categoryId?, amountCents?, dateTimestamp?, label?, description? })',
        'DELETE /api/transactions/:id': 'Delete an authenticated user transaction',
      },
      investments: {
        'GET /api/investments': 'List investments owned by the authenticated user',
        'POST /api/investments': 'Create an investment for the authenticated user (Body: { categoryId, amountCents, dateTimestamp, monthlyRate, monthsDuration, description? })',
        'PATCH /api/investments/:id': 'Update investment fields owned by the authenticated user',
        'DELETE /api/investments/:id': 'Delete an investment owned by the authenticated user',
      }
    }
  };

app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>BudgetWallet_Server</title>
      </head>
      <body>
        <h1>Budget-Wallet API</h1>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
    </html>
  `);
});

registerAuthenticationRoutes(app);
registerCategoriesRoutes(app);
registerTransactionsRoutes(app);
registerInvestmentsRoutes(app);
registerDashboardRoutes(app);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('Unexpected API error:', error);
  res.status(500).json({ error: 'Internal Server Fail.' });
};

app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Budget-Wallet API Server is running on http://localhost:${PORT}`);
});

export default app;
