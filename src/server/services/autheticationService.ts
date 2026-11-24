import type { Express, Request, Response, NextFunction } from 'express';
import { Prisma } from '../../generated/prisma/client.ts';
import { User } from '../../entities/user.ts';
import { UserRepository } from '../../repository/userRepository.ts';
import { TransactionCategoryRepository } from '../../repository/transactionCategoryRepository.ts';
import { comparePassword, generateToken, hashPassword } from '../auth.ts';

const userRepo = new UserRepository();
const categoryRepo = new TransactionCategoryRepository();

/** Register authentication endpoints on the already-configured Express app. */
export function registerAuthenticationRoutes(app: Express): void {
  /**
   * POST /api/auth/signup
   * Create a new user account
   * Body: { name: string, email: string, username: string, password: string, confirmPassword: string }
   */
  app.post('/api/auth/signup', async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, username, password, confirmPassword } = req.body;

    let user: User;
    try {
      user = new User(null, name, email, username);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid data.',
      });
    }

    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (typeof confirmPassword !== 'string' || password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const passwordHash = await hashPassword(password);

    try {
      user = await userRepo.create(user, passwordHash);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes('email')) {
          return res.status(409).json({ error: 'E-mail já cadastrado.' });
        }
        if (Array.isArray(target) && target.includes('username')) {
          return res.status(409).json({ error: 'Username já cadastrado.' });
        }
        return res.status(409).json({ error: 'E-mail ou username já cadastrado.' });
      }
      return next(error);
    }

    await categoryRepo.createDefaultCategoriesForUser(user.id);

    return res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, name: user.name, email: user.email }
    });
  });

  /**
   * POST /api/auth/signin
   * Authenticate with email or username and password.
   * Body: { identifier: string, password: string }
   */
  app.post('/api/auth/signin', async (req: Request, res: Response, next: NextFunction) => {
    const { identifier, password } = req.body;

    if (typeof identifier !== 'string' || identifier.trim().length === 0) {
      return res.status(400).json({ error: 'Informe seu e-mail ou username.' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'Informe sua senha.' });
    }

    try {
      const credentials = await userRepo.findUserByIdentifierWithPassword(identifier);
      if (!credentials || !(await comparePassword(password, credentials.passwordHash))) {
        return res.status(401).json({ error: 'E-mail/username ou senha inválidos.' });
      }

      const token = generateToken(credentials.user.id);
      return res.status(200).json({
        message: 'Login realizado com sucesso.',
        user: {
          id: credentials.user.id,
          name: credentials.user.name,
          email: credentials.user.email,
          username: credentials.user.username,
        },
        token,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/auth/recover
   * Temporarily reset a password using an email address or username.
   * Body: { identifier: string, newPassword: string, confirmPassword: string }
   * This endpoint does not prove account ownership; token verification is still required before production use.
   */
  app.post('/api/auth/recover', async (req: Request, res: Response, next: NextFunction) => {
    const { identifier, newPassword, confirmPassword } = req.body;

    if (typeof identifier !== 'string' || identifier.trim().length === 0) {
      return res.status(400).json({ error: 'Informe seu e-mail ou username.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length === 0) {
      return res.status(400).json({ error: 'Informe a nova senha.' });
    }
    if (typeof confirmPassword !== 'string' || newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    try {
      const passwordHash = await hashPassword(newPassword);
      const user = await userRepo.updatePasswordHashByIdentifier(identifier, passwordHash);

      if (!user) {
        return res.status(404).json({ error: 'Conta não encontrada para esse e-mail ou username.' });
      }

      return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    } catch (error) {
      return next(error);
    }
  });
}
