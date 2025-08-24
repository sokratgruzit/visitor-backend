-- DropForeignKey
ALTER TABLE "Animation" DROP CONSTRAINT "Animation_userId_fkey";

-- AlterTable
ALTER TABLE "Animation" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Animation" ADD CONSTRAINT "Animation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
