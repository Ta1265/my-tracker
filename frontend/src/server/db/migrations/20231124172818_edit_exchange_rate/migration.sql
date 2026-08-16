/*
  Warnings:

  - You are about to drop the column `currency` on the `ExchangeRate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[unit]` on the table `ExchangeRate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unit` to the `ExchangeRate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ExchangeRate` DROP COLUMN `currency`,
    ADD COLUMN `unit` VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ExchangeRate_unit_key` ON `ExchangeRate`(`unit`);
