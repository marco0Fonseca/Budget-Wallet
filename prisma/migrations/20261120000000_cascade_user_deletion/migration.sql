-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransactionCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" INTEGER,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TransactionCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransactionCategory_parentId_userId_type_fkey" FOREIGN KEY ("parentId", "userId", "type") REFERENCES "TransactionCategory" ("id", "userId", "type") ON DELETE NO ACTION ON UPDATE RESTRICT
);
INSERT INTO "new_TransactionCategory" ("id", "label", "parentId", "type", "userId") SELECT "id", "label", "parentId", "type", "userId" FROM "TransactionCategory";
DROP TABLE "TransactionCategory";
ALTER TABLE "new_TransactionCategory" RENAME TO "TransactionCategory";
CREATE INDEX "TransactionCategory_userId_type_idx" ON "TransactionCategory"("userId", "type");
CREATE INDEX "TransactionCategory_parentId_userId_type_idx" ON "TransactionCategory"("parentId", "userId", "type");
CREATE UNIQUE INDEX "TransactionCategory_id_userId_key" ON "TransactionCategory"("id", "userId");
CREATE UNIQUE INDEX "TransactionCategory_id_userId_type_key" ON "TransactionCategory"("id", "userId", "type");
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dateTimestamp" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Transaction_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "TransactionCategory" ("id", "userId") ON DELETE NO ACTION ON UPDATE RESTRICT,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amountCents", "categoryId", "dateTimestamp", "description", "id", "userId") SELECT "amountCents", "categoryId", "dateTimestamp", "description", "id", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_dateTimestamp_idx" ON "Transaction"("userId", "dateTimestamp");
CREATE INDEX "Transaction_categoryId_userId_idx" ON "Transaction"("categoryId", "userId");
CREATE TABLE "new_Investment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "dateTimestamp" BIGINT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "monthlyRate" REAL NOT NULL,
    "monthsDuration" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Investment_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "TransactionCategory" ("id", "userId") ON DELETE NO ACTION ON UPDATE RESTRICT,
    CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Investment" ("amountCents", "categoryId", "dateTimestamp", "description", "id", "monthlyRate", "monthsDuration", "userId") SELECT "amountCents", "categoryId", "dateTimestamp", "description", "id", "monthlyRate", "monthsDuration", "userId" FROM "Investment";
DROP TABLE "Investment";
ALTER TABLE "new_Investment" RENAME TO "Investment";
CREATE INDEX "Investment_userId_dateTimestamp_idx" ON "Investment"("userId", "dateTimestamp");
CREATE INDEX "Investment_categoryId_userId_idx" ON "Investment"("categoryId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
