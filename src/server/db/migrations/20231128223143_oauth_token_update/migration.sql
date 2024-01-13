/*
  Warnings:

  - You are about to drop the column `clientId` on the `OuathToken` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `OuathToken` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenExpiresOn` on the `OuathToken` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `OuathToken` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `OuathToken_refreshToken_key` ON `OuathToken`;

-- AlterTable
ALTER TABLE `OuathToken` DROP COLUMN `clientId`,
    DROP COLUMN `refreshToken`,
    DROP COLUMN `refreshTokenExpiresOn`,
    DROP COLUMN `scope`;
