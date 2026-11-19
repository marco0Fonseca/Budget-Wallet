-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAtTimestamp" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" INTEGER,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TransactionCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransactionCategory_parentId_userId_type_fkey" FOREIGN KEY ("parentId", "userId", "type") REFERENCES "TransactionCategory" ("id", "userId", "type") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dateTimestamp" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Transaction_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "TransactionCategory" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "dateTimestamp" BIGINT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "monthlyRate" REAL NOT NULL,
    "monthsDuration" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Investment_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "TransactionCategory" ("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "TransactionCategory_userId_type_idx" ON "TransactionCategory"("userId", "type");

-- CreateIndex
CREATE INDEX "TransactionCategory_parentId_userId_type_idx" ON "TransactionCategory"("parentId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategory_id_userId_key" ON "TransactionCategory"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategory_id_userId_type_key" ON "TransactionCategory"("id", "userId", "type");

-- CreateIndex
CREATE INDEX "Transaction_userId_dateTimestamp_idx" ON "Transaction"("userId", "dateTimestamp");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_userId_idx" ON "Transaction"("categoryId", "userId");

-- CreateIndex
CREATE INDEX "Investment_userId_dateTimestamp_idx" ON "Investment"("userId", "dateTimestamp");

-- CreateIndex
CREATE INDEX "Investment_categoryId_userId_idx" ON "Investment"("categoryId", "userId");
