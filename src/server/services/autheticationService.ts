import type { Express, Request, Response, NextFunction } from 'express';
import { Prisma } from '../../generated/prisma/client.ts';
import { User } from '../../entities/user.ts';
import { UserRepository } from '../../repository/userRepository.ts';
import { TransactionCategoryRepository } from '../../repository/transactionCategoryRepository.ts';
import { generateToken, hashPassword } from '../auth.ts';

const userRepo = new UserRepository();
const categoryRepo = new TransactionCategoryRepository();

/** Register authentication endpoints on the already-configured Express app. */
export function registerAuthenticationRoutes(app: Express): void {
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

    const token = generateToken(user.id);
    return res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  });
}
