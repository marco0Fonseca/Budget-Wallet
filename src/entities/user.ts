import { randomUUID } from 'node:crypto';

//For security and coherence user passaword is hashed on database and not treated here

export class User {
  public readonly id: string; //UUID

  public readonly name: string;

  public readonly email: string;
  public readonly username: string; //Used as nickname and login alternative

  public readonly createdAtTimestamp: number;

  constructor(id : string|null , name: string, email: string, username: string,  createdAtTimestamp: number = Date.now()) {
    const userId = id ?? randomUUID();
    const createdAt = new Date(createdAtTimestamp);

    if (typeof userId !== 'string' || userId.trim().length === 0 || userId !== userId.trim()) {
      throw new Error('User identifier is invalid');
    }

    if (!(createdAt instanceof Date) || !Number.isFinite(createdAt.getTime())) {
      throw new Error('Creation date is invalid');
    }

    this.id = userId;
    this.name = User.validateName(name);
    this.email = User.validateEmail(email);
    this.username = User.validateUsername(username);
    this.createdAtTimestamp = createdAt.getTime();

    Object.freeze(this);
  }

  static validateUsername(username: string): string {
    if (typeof username !== 'string' || !/^[a-z0-9._-]+$/.test(username.trim())) {
      throw new Error('Username must contain only lowercase letters, numbers, dots, hyphens or underscores.');
    }

    return username.trim();
  }

  static validateName(name: string): string {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Name is required.');
    }

    return name.trim();
  }
  
  static validateEmail(email: string): string {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error('Invalid E-mail.');
    }

    return email.trim();
  } 
}
