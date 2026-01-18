/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.
  - Made the column `organizerId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `invoiceId` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_organizerId_fkey";

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "organizerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "invoiceId" TEXT NOT NULL,
ADD COLUMN     "reference" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_reference_key" ON "Reservation"("reference");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
