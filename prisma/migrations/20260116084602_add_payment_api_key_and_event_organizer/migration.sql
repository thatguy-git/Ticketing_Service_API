-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "organizerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paymentApiKey" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
