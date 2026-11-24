import jwt, {type SignOptions} from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const SALT_ROUNDS = 12;

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export async function hashPassword(plainPassword : string) : Promise<string> {
    return await bcrypt.hash(plainPassword,SALT_ROUNDS);
}

export async function comparePassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string' || decoded.userId.trim().length === 0) {
      return null;
    }

    return decoded.userId;
  } catch {
    return null;
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.get('authorization');
  const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!bearerMatch || !bearerMatch[1]) {
    res.status(401).json({ error: 'Access token required.' });
    return;
  }

  const userId = verifyToken(bearerMatch[1]);
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired access token.' });
    return;
  }

  req.userId = userId;
  next();
}
