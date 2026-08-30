import { Migration } from '@mikro-orm/migrations';

/**
 * Baseline: the schema as it stood when this service took over from Prisma, transcribed
 * from a mysqldump so the pre-existing tables keep their exact column order, per-table
 * charsets (some latin1, some utf8mb4) and the hand-built TradeTransaction view.
 * Existing databases have this recorded as applied rather than run - see
 * dumps/PortfolioSchema20260829.sql. Every statement is IF NOT EXISTS / OR REPLACE so a
 * re-run against a populated database is a no-op; dropping belongs in down(), not here.
 * IF NOT EXISTS is a bootstrap guard, not drift detection: against a database whose table
 * already exists in a different shape, up() succeeds silently and changes nothing.
 */
export class Migration20260829113341 extends Migration {
  override name = 'Migration20260829113341';

  override up(): void | Promise<void> {
    this.addSql(
      `create table if not exists \`User\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`email\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`username\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`image\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`name\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`password\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`User_email_key\` (\`email\`),
  UNIQUE KEY \`User_username_key\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    this.addSql(
      `create table if not exists \`TokenInfo\` (
  \`token_id\` int(11) NOT NULL,
  \`symbol\` varchar(45) DEFAULT NULL,
  \`slug\` varchar(45) DEFAULT NULL,
  \`name\` varchar(45) DEFAULT NULL,
  \`rank\` int(11) DEFAULT NULL,
  PRIMARY KEY (\`token_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;`,
    );

    this.addSql(
      `create table if not exists \`ExchangeRate\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`date\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`rate\` float NOT NULL,
  \`unit\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`ExchangeRate_unit_key\` (\`unit\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    this.addSql(
      `create table if not exists \`NetCashFlow\` (
  \`date\` datetime NOT NULL,
  \`netCash\` decimal(18,2) NOT NULL,
  \`netContributions\` decimal(18,2) NOT NULL,
  \`userId\` int(11) NOT NULL,
  \`valueOfHoldings\` decimal(18,2) NOT NULL,
  \`profitLoss\` decimal(18,2) NOT NULL,
  \`totalCostBasis\` decimal(18,2) NOT NULL,
  \`roi\` decimal(18,2) NOT NULL,
  \`ror\` decimal(18,2) NOT NULL,
  PRIMARY KEY (\`date\`,\`userId\`),
  KEY \`userId_idx\` (\`userId\`),
  CONSTRAINT \`userId\` FOREIGN KEY (\`userId\`) REFERENCES \`User\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;`,
    );

    this.addSql(
      `create table if not exists \`OuathToken\` (
  \`id\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`userId\` int(11) NOT NULL,
  \`accessToken\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`accessTokenExpiresOn\` datetime(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`OuathToken_accessToken_key\` (\`accessToken\`),
  KEY \`OuathToken_userId_fkey\` (\`userId\`),
  CONSTRAINT \`OuathToken_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    this.addSql(
      `create table if not exists \`TokenPriceHistory\` (
  \`close_price\` decimal(18,2) NOT NULL,
  \`date\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`token_info_id\` int(11) NOT NULL,
  \`TokenPriceHistorycol\` varchar(45) DEFAULT NULL,
  \`timeFrame\` varchar(255) NOT NULL,
  PRIMARY KEY (\`token_info_id\`,\`date\`,\`close_price\`,\`timeFrame\`),
  CONSTRAINT \`TokenPriceHistory_ibfk_1\` FOREIGN KEY (\`token_info_id\`) REFERENCES \`TokenInfo\` (\`token_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;`,
    );

    this.addSql(
      `create table if not exists \`Transaction\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`product\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`date\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`side\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`size\` float NOT NULL,
  \`unit\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`price\` float NOT NULL,
  \`fee\` float NOT NULL,
  \`total\` float NOT NULL,
  \`notes\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`coinName\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`userId\` int(11) NOT NULL DEFAULT '1',
  \`token_info_id\` int(11) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`Transaction_userId_fkey\` (\`userId\`),
  CONSTRAINT \`Transaction_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\` (\`id\`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    );

    this.addSql(
      `create or replace view \`TradeTransaction\` as select date_format(\`Transaction\`.\`date\`,'%m/%d/%Y %H:%i:%s') AS \`Date\`,(case when (\`Transaction\`.\`side\` = 'BUY') then \`Transaction\`.\`size\` else (\`Transaction\`.\`price\` * \`Transaction\`.\`size\`) end) AS \`ReceivedQuantity\`,(case when (\`Transaction\`.\`side\` = 'BUY') then \`Transaction\`.\`unit\` else 'USD' end) AS \`ReceivedCurrency\`,(case when (\`Transaction\`.\`side\` = 'BUY') then (\`Transaction\`.\`price\` * \`Transaction\`.\`size\`) else \`Transaction\`.\`size\` end) AS \`SentQuantity\`,(case when (\`Transaction\`.\`side\` = 'BUY') then 'USD' else \`Transaction\`.\`unit\` end) AS \`SentCurrency\`,\`Transaction\`.\`fee\` AS \`FeeAmount\`,'USD' AS \`Fee Currency\`,\`Transaction\`.\`userId\` AS \`userId\` from \`Transaction\`;`,
    );
  }

  override down(): void | Promise<void> {
    throw new Error(
      'Migration20260829113341 (the baseline) was recorded as applied via a manual ' +
        'ledger insert, not run - up() never created these tables, they already held ' +
        'live data when the ledger row was added. Rolling it back would not undo this ' +
        'migration, it would drop tables it never created, including every row in ' +
        '`TokenPriceHistory`, `Transaction`, `User` and the rest. ' +
        'If you are intentionally tearing down a throwaway database and want the ' +
        'baseline gone, do not run `migration:down` - copy the statements out of ' +
        'Migration20260829113341.downSqlForThrowawayReset() in this file and run them ' +
        'by hand against that database.',
    );
  }

  /**
   * The drop statements down() refuses to run automatically. Kept for an operator who is
   * intentionally resetting a throwaway database and wants the exact inverse of up() -
   * copy these into a client and run them by hand. See down() for why this is not wired
   * up as the migrator's rollback path.
   */
  private downSqlForThrowawayReset(): string[] {
    return [
      'drop view if exists `TradeTransaction`;',
      'drop table if exists `Transaction`;',
      'drop table if exists `TokenPriceHistory`;',
      'drop table if exists `OuathToken`;',
      'drop table if exists `NetCashFlow`;',
      'drop table if exists `ExchangeRate`;',
      'drop table if exists `TokenInfo`;',
      'drop table if exists `User`;',
    ];
  }
}
