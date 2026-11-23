import express, { type Request, type Response } from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { registerAuthenticationRoutes } from './services/autheticationService.ts';

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
      auth: {
        'POST /api/auth/signup': 'Create a new user account (Body: { name: string, email: string, username: string, password: string, confirmPassword: string })',
      },
      users: {
      },
      categories: {
      },
      transactions: {
      },
      investments: {
      }
    }
  };

app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>fd_Server</title>
      </head>
      <body>
        <h1>Budget-Wallet API</h1>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
    </html>
  `);
});

registerAuthenticationRoutes(app);

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
