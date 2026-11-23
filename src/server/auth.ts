import jwt, {type SignOptions} from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export async function hashPassword(plainPassword : string) : Promise<string> {
    return await bcrypt.hash(plainPassword,SALT_ROUNDS);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}