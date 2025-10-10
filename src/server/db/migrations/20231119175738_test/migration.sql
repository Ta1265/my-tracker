-- CreateTable
CREATE TABLE `Post` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` VARCHAR(191) NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `authorId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bio` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;








USE PORTFOLIO;

SELECT 
    tph.date,
    u.id as userId,
    u.username,
    ti.symbol,
    ti.name as tokenName,
    
    -- Calculate running quantity (cumulative buys - sells)
    COALESCE(SUM(
        CASE 
            WHEN t.side = 'BUY' AND t.date <= tph.date THEN t.size
            WHEN t.side = 'SELL' AND t.date <= tph.date THEN -t.size
            ELSE 0
        END
    ), 0) as currentHoldings,
    
    -- Calculate cost basis (total invested - total sold)
    COALESCE(SUM(
        CASE 
            WHEN t.side = 'BUY' AND t.date <= tph.date THEN t.total
            WHEN t.side = 'SELL' AND t.date <= tph.date THEN -t.total
            ELSE 0
        END
    ), 0) as costBasis,
    
    -- Current market value of holdings (holdings * price on this date)
    (COALESCE(SUM(
        CASE 
            WHEN t.side = 'BUY' AND t.date <= tph.date THEN t.size
            WHEN t.side = 'SELL' AND t.date <= tph.date THEN -t.size
            ELSE 0
        END
    ), 0) * tph.close_price) as valueOfHoldings,
    
    -- Profit and Loss (current value - cost basis)
    ((COALESCE(SUM(
        CASE 
            WHEN t.side = 'BUY' AND t.date <= tph.date THEN t.size
            WHEN t.side = 'SELL' AND t.date <= tph.date THEN -t.size
            ELSE 0
        END
    ), 0) * tph.close_price) - 
    COALESCE(SUM(
        CASE 
            WHEN t.side = 'BUY' AND t.date <= tph.date THEN t.total
            WHEN t.side = 'SELL' AND t.date <= tph.date THEN -t.total
            ELSE 0
        END
    ), 0)) as profitAndLoss,
    
    -- Net cash holdings from NetCashFlow table
    ncf.netCash,
    ncf.netContributions,
    
    tph.close_price as tokenPrice

FROM TokenPriceHistory tph
INNER JOIN TokenInfo ti 
	ON tph.token_info_id = ti.token_id
CROSS JOIN User u
LEFT JOIN Transaction t 
	ON t.token_info_id = ti.token_id 
  AND t.userId = u.id
LEFT JOIN NetCashFlow ncf 
	ON ncf.date = tph.date 
  AND ncf.userId = u.id

WHERE 
	tph.date >= DATE_SUB(CURDATE(), INTERVAL 10 YEAR)
  AND u.id = 1

GROUP BY 
    tph.date, 
    u.id, 
    u.username, 
    ti.token_id, 
    ti.symbol, 
    ti.name, 
    tph.close_price,
    ncf.netCashHoldings,
    ncf.netContributions

HAVING currentHoldings != 0 OR costBasis != 0

ORDER BY 
    u.id, 
    ti.symbol, 
    tph.date;
