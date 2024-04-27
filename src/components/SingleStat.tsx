import React, { useEffect, useState } from 'react';
import Skeleton from '@mui/joy/Skeleton';

interface SingleStatProps {
  unit: String;
  priceChange: number | null;
  timeFrame: TimeFrame;
  timeFrameStartPrice: number;
}

const useGetUnitStats = (unit: String) => {
  const [unitStats, setUnitStats] = useState<FormattedProductStats | null>(
    null,
  );
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!unit) return;
    setLoading(true);
    fetch(`/api/stats/${unit}`)
      .then((res) => res.json())
      .then((resp: FormattedProductStats) => {
        setUnitStats(resp);
        setLoading(false);
      });
  }, [unit]);

  return { unitStats, isLoading };
};

const SingleStat: React.FC<SingleStatProps> = ({
  unit,
  priceChange,
  timeFrame,
  timeFrameStartPrice,
}) => {
  const { unitStats, isLoading } = useGetUnitStats(unit);

  const showSkeleton = isLoading || !unitStats;

  // if (isLoading || !unitStats) {
  //   return <div>loading...</div>;
  // }

  return (
    <div className="flex table-fixed justify-center">
      <table className="text-grey-700 flex table text-left text-lg text-gray-500 dark:text-gray-400">
        <thead className="justify-between text-xl text-gray-700 text-gray-700 dark:text-gray-400 md:text-lg">
          <tr>
            <th className="px-5 py-2">Holdings</th>
            <th className="px-5">AVG. Buy / Sell</th>
            <th className="px-5">Cost Basis</th>
            <th className="px-5">P/L All Time</th>
            <th className="px-5">
              P/L
              {(() => {
                if (timeFrame === 'h') return ' 1 Hour';
                if (timeFrame === 'd') return ' 24 Hour';
                if (timeFrame === 'w') return ' 7 Days';
                if (timeFrame === 'm') return ' 30 Days';
                if (timeFrame === '3m') return ' 3 Months';
                if (timeFrame === '6m') return ' 6 Months';
                if (timeFrame === 'y') return ' 1 Yeay';
                if (timeFrame === 'all') return 'All Time';
              })()}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-2xl md:text-lg">
            <td>
              {showSkeleton ? (
                <Skeleton
                  overlay={true}
                  width={150}
                  height={50}
                  loading={showSkeleton}
                  variant="rectangular"
                />
              ) : (
                <div className="text-center">
                  <span>{unitStats.valueOfHoldings}</span>
                  <br></br>
                  <span className="text-sm">{unitStats.holdings}</span>
                </div>
              )}
            </td>
            <td>
              {showSkeleton ? (
                <Skeleton
                  overlay={true}
                  loading={showSkeleton}
                  width={150}
                  height={50}
                  variant="rectangular"
                />
              ) : (
                <div className="text-center">
                  <span>{unitStats.avgPurchasePrice}</span> /
                  <br />
                  <span>{unitStats.avgSellPrice}</span>
                </div>
              )}
            </td>
            <td>
              {showSkeleton ? (
                <Skeleton
                  overlay={true}
                  loading={showSkeleton}
                  width={150}
                  height={50}
                  variant="rectangular"
                />
              ) : (
                <div className="text-center">{unitStats.breakEvenPrice}</div>
              )}
            </td>
            <td>
              {showSkeleton ? (
                <Skeleton
                  overlay={true}
                  width={150}
                  height={50}
                  loading={showSkeleton}
                  variant="rectangular"
                />
              ) : (
                <div
                  className="text-center"
                  style={{
                    color:
                      unitStats.percentPL[0] === '-' ? '#F0616D' : '#27AD75',
                  }}
                >
                  <span>{unitStats.profitLossAtCurrentPrice} </span>
                  <br />
                  <span className="text-lg md:text-sm">
                    {' '}
                    {unitStats.percentPL}
                  </span>
                </div>
              )}
            </td>
            <td>
              {showSkeleton ? (
                <Skeleton
                  overlay={true}
                  width={150}
                  height={50}
                  loading={showSkeleton}
                  variant="rectangular"
                />
              ) : (
                <>
                  {priceChange ? (
                    <div
                      className="text-center"
                      style={{
                        color: priceChange < 0 ? '#F0616D' : '#27AD75',
                      }}
                    >
                      {(() => {
                        if (!timeFrameStartPrice) return '...';
                        const holdings = parseFloat(unitStats.holdings);
                        const currentValue = parseFloat(
                          unitStats.valueOfHoldings.replace(/[$,]/g, ''),
                        );
                        const prevValue = holdings * timeFrameStartPrice;
                        const profitLoss = currentValue - prevValue;
                        return profitLoss.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 2,
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center">...</div>
                  )}
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default SingleStat; /* eslint-disable react/jsx-key */
