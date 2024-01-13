-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product` VARCHAR(255) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `side` VARCHAR(255) NOT NULL,
    `size` FLOAT NOT NULL,
    `unit` VARCHAR(255) NOT NULL,
    `price` FLOAT NOT NULL,
    `fee` FLOAT NOT NULL,
    `total` FLOAT NOT NULL,
    `notes` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
