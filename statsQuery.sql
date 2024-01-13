
SELECT
  stats.unit AS productName,
  COALESCE(stats.latestExchangeRate.rate,0) AS currentPrice,
  COALESCE(stats.buy_count,0) AS countBuys,
  COALESCE(stats.sell_count,0) AS countSells,
  COALESCE(stats.total_buy_quantity,0) AS totalBuyQuantity,
  COALESCE(stats.total_sell_quantity,0) AS totalSellQuantity,
  COALESCE(-1 * stats.total_buy_cost,0) AS totalBuyCost,
  COALESCE(stats.total_sell_profits,0) AS totalSellProfits,
  COALESCE(stats.total_buy_quantity - stats.total_sell_quantity,0) AS holdings,
  COALESCE(-1* (stats.total_buy_cost / stats.total_buy_quantity), 0) AS avgPurchasePrice,
  COALESCE(stats.total_sell_profits / stats.total_sell_quantity,0) AS avgSellPrice,
  COALESCE((stats.latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity)),0) AS valueOfHoldings,
  COALESCE((stats.total_sell_profits - (-1 * stats.total_buy_cost) + (stats.latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity))),0) AS profitLossAtCurrentPrice,
  COALESCE((-1 * ((stats.total_sell_profits - (-1 * stats.total_buy_cost)) / (stats.total_buy_quantity - stats.total_sell_quantity))),0) AS breakEvenPrice,
  COALESCE(((stats.total_sell_profits - (-1 * stats.total_buy_cost) + (stats.latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity))) / (-1 * stats.total_buy_cost)) * 100, 0) AS percentPL
FROM (
	SELECT
		trans.unit,
    SUM(CASE WHEN side = 'BUY' THEN 1 ELSE 0 END) as buy_count,
    SUM(CASE WHEN side = 'SELL' THEN 1 ELSE 0 END) as sell_count,

		SUM(CASE WHEN trans.side = 'BUY' THEN trans.size ELSE 0 END) AS total_buy_quantity,
		SUM(CASE WHEN trans.side = 'SELL' THEN trans.size ELSE 0 END) AS total_sell_quantity,
		SUM(CASE WHEN trans.side = 'BUY' THEN trans.total ELSE 0 END) AS total_buy_cost,
		SUM(CASE WHEN trans.side = 'SELL' THEN trans.total ELSE 0 END) AS total_sell_profits,

    AVG(CASE WHEN trans.side = 'BUY' THEN trans.total ELSE NULL END) AS avg_buy_cost,
    AVG(CASE WHEN trans.side = 'SELL' THEN trans.total ELSE NULL END) AS avg_sell_profits
	FROM
		PORTFOLIO.Transaction as trans
	GROUP BY unit
) as stats
  JOIN (
    SELECT unit, rate
    FROM PORTFOLIO.ExchangeRate
    WHERE date = (
      SELECT MAX(date)
      FROM PORTFOLIO.ExchangeRate
    )
  ) as latestExchangeRate
  ON stats.unit = latestExchangeRate.unit
  ORDER BY valueOfHoldings DESC;