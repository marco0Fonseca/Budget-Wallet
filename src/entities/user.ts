import { randomUUID } from 'node:crypto';

//For security and coherence user passaword is hashed on database and not treated here

export class User {
  public readonly id: string; //UUID

  public readonly name: string;

  public readonly email: string;
  public readonly username: string; //Used as nickname and login alternative

  public readonly createdAtTimestamp: number;

  constructor(id : string|null , name: string, email: string, username: string,  createdAtTimestamp: number = Date.now()) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Name is required.');
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error('Invalid E-mail.');
    }

    if (typeof username !== 'string' || !/^[a-z0-9._-]+$/.test(username.trim())) {
      throw new Error('Username must contain only lowercase letters, numbers, dots, hyphens or underscores.');
    }

    const userId = id ?? randomUUID();
    const createdAt = new Date(createdAtTimestamp);

    if (typeof userId !== 'string' || userId.trim().length === 0 || userId !== userId.trim()) {
      throw new Error('User identifier is invalid');
    }

    if (!(createdAt instanceof Date) || !Number.isFinite(createdAt.getTime())) {
      throw new Error('Creation date is invalid');
    }

    this.id = userId;
    this.name = name.trim();
    this.email = email.trim();
    this.username = username.trim();
    this.createdAtTimestamp = createdAt.getTime();

    Object.freeze(this);
  }
}
