import React, { useEffect, useState } from 'react';
import Skeleton from '@mui/joy/Skeleton';
// import { Grid, Typography, Box } from '@mui/material';


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

  const labelClass = 'font-semibold underline decoration-dotted py-1';
  const valueClass = 'font-light text-white';

  const statWrapper = 'text-center w-[120px] md:basis-1/5 py-2 px-2';

  return (
    <div
      className="
        text-grey-700 
        flex 
        flex-wrap 
        text-center 
        text-gray-500 
        dark:text-gray-400
        text-xs
        md:text-base
        lg:text-lg
        md:justify-between
      "
    >
      <div className={statWrapper}>
        <div className="flex-col">
          <div className={labelClass}>Holdings</div>
          <div className={valueClass}>
            {showSkeleton ? (
              <Skeleton
                width={(() => window.innerWidth < 768 ? 120 : 150)()}
                height={40}
                loading={true}
                variant="rectangular"
              >
              </Skeleton>
            ) : (
              <div className="text-center">
                <span>{unitStats.valueOfHoldings}</span>
                <br></br>
                <span className="">{unitStats.holdings}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={statWrapper}>
        <div className="flex-col">
          <div className={labelClass}>AVG. Buy / Sell</div>
          <div className={valueClass}>
            {showSkeleton ? (
              <Skeleton
                width={(() => window.innerWidth < 768 ? 120 : 150)()}
                height={40}
                loading={true}
                variant="rectangular"
              >
              </Skeleton>
            ) : (
              <div className="grid-rows-2 text-center">
                <div>{unitStats.avgPurchasePrice} /</div>
                <div>{unitStats.avgSellPrice}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={statWrapper}>
        <div className="flex-col">
          <div className={labelClass}>Break Even</div>
          <div className={valueClass}>
            {showSkeleton ? 
              <Skeleton
                width={(() => window.innerWidth < 768 ? 100 : 150)()}
                height={40}
                loading={true}
                variant="rectangular"
              >
              </Skeleton>
          
            : <div>{unitStats.breakEvenPrice}</div>}
          </div>
        </div>
      </div>

      <div className={statWrapper}>
        <div className="flex-col">
          <div className={labelClass}>P/L All Time</div>
          <div className={valueClass}>
            {showSkeleton ? (
              <Skeleton
                width={(() => window.innerWidth < 768 ? 120 : 150)()}
                height={40}
                loading={true}
                variant="rectangular"
              >
              </Skeleton>
            ) : (
              <div
                className="flex-col"
                style={{
                  color: unitStats.percentPL[0] === '-' ? '#F0616D' : '#27AD75',
                }}
              >
                <span>{unitStats.profitLossAtCurrentPrice} </span>
                <br />
                <span className=""> {unitStats.percentPL}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={statWrapper}>
        <div className="flex-col">
          <div className={labelClass}>
            P/L
            {(() => {
              if (timeFrame === 'h') return ' 1 Hour';
              if (timeFrame === 'd') return ' 24 Hour';
              if (timeFrame === 'w') return ' 7 Days';
              if (timeFrame === 'm') return ' 30 Days';
              if (timeFrame === '3m') return ' 3 Months';
              if (timeFrame === '6m') return ' 6 Months';
              if (timeFrame === 'y') return ' 1 Year';
              if (timeFrame === 'all') return 'All Time';
            })()}
          </div>
          <div className={valueClass}>
            {showSkeleton ? (
              <Skeleton
                width={(() => window.innerWidth < 768 ? 120 : 150)()}
                height={40}
                loading={true}
                variant="rectangular"
              >
              </Skeleton>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleStat; /* eslint-disable react/jsx-key */
