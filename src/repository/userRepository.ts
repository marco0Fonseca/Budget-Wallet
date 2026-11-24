import type { User as PrismaUser } from '../generated/prisma/client.ts';
import { User } from '../entities/user.ts';
import { prisma } from '../repository/repository.ts';

export class UserRepository {
    private toEntity(userData: PrismaUser): User {
        return new User(
            userData.id,
            userData.name,
            userData.email,
            userData.username,
            Number(userData.createdAtTimestamp),
        );
    }
    
    async create(user : User, passwordHash : string) : Promise<User>{

    await prisma.user.create({
      data :{
        id : user.id,
        name : user.name,
        email : user.email,
        username : user.username,
        passwordHash,
        createdAtTimestamp : user.createdAtTimestamp
      }
    });

    return user;
    }

    async findUserById(id: string) : Promise<User | null> {
        const userData = await prisma.user.findUnique({
            where: { id },
        });

        if (!userData) return null;

        return this.toEntity(userData);
    }

    async findUserByEmail(email: string) : Promise<User | null> {
        const userData = await prisma.user.findUnique({
            where: { email }
        })

        if (!userData) return null;

        return this.toEntity(userData);
    }

    async findUserByUsername(username: string) : Promise<User | null> {
        const userData = await prisma.user.findUnique({
            where: { username }
        })

        if (!userData) return null;

        return this.toEntity(userData);
    }

    async findUserByEmailWithPassword(email: string) : Promise<{ user: User; passwordHash: string } | null> {
        const userData = await prisma.user.findUnique({
            where: { email }
        })

        if(!userData) return null;

        const user = this.toEntity(userData);

        return { user, passwordHash: userData.passwordHash };
    }

    async findUserByIdentifierWithPassword(identifier: string): Promise<{ user: User; passwordHash: string } | null> {
        if (typeof identifier !== 'string' || identifier.trim().length === 0) {
            throw new Error('Email or username is required.');
        }

        const normalizedIdentifier = identifier.trim();
        const userData = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalizedIdentifier },
                    { username: normalizedIdentifier },
                ],
            },
        });

        if (!userData) return null;

        return { user: this.toEntity(userData), passwordHash: userData.passwordHash };
    }

    async updateName(id: string, newName: string) : Promise<User> {
        const validatedName = User.validateName(newName);

        const userData = await prisma.user.update({
            where: { id },
            data: { name: validatedName },
        });

        return this.toEntity(userData);
    }

    async updateEmail(id: string, newEmail: string) : Promise<User> {
      const validatedEmail = User.validateEmail(newEmail);

      const userData = await prisma.user.update({
        where: { id : id },
        data: { email: validatedEmail }
      });

      return this.toEntity(userData);
    }

    async updateUsername(id: string, newUsername: string): Promise<User> {
      const validatedUsername = User.validateUsername(newUsername);

      const userData = await prisma.user.update({
        where: { id },
        data: { username: validatedUsername },
      });

      return this.toEntity(userData);
    }

    /*
     * Keep the authenticated-account version for the future token-based recovery flow.
    async updatePasswordHash(id: string, newPasswordHash: string) : Promise<User> {
      const userData = await prisma.user.update({
        where: { id },
        data: { passwordHash: newPasswordHash },
      });

      return this.toEntity(userData);
    }
    */

    async updatePasswordHashByIdentifier(identifier: string, newPasswordHash: string): Promise<User | null> {
      if (typeof identifier !== 'string' || identifier.trim().length === 0) {
        throw new Error('Email or username is required.');
      }
      if (typeof newPasswordHash !== 'string' || newPasswordHash.length === 0) {
        throw new Error('Password hash is required.');
      }

      const normalizedIdentifier = identifier.trim();
      const userData = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedIdentifier },
            { username: normalizedIdentifier },
          ],
        },
      });

      if (!userData) return null;

      const updatedUserData = await prisma.user.update({
        where: { id: userData.id },
        data: { passwordHash: newPasswordHash },
      });

      return this.toEntity(updatedUserData);
    }

    async delete(id : string): Promise<User> {
      const userData = await prisma.user.delete({
        where: { id }
      });
      return this.toEntity(userData);
    }
}
