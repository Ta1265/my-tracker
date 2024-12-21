import Grid from "@mui/material/Grid";
import React from "react";
import TickerDisplay from '../TickerDisplay';
import Skeleton from '@mui/joy/Skeleton';
import { usePriceFeed } from '../../context/CoinbaseWsFeedContext';
import { usePriceHistory } from "../../context/PriceHistoryProvider";
import AnimatingNumber from "../AnimatingNumber";

interface Props {
}

export const TitleAndPriceDisplay: React.FC<{}> = () => {
  const {
    coinName,
    unit,
    hoveringChart,
    hoverPrice,
    startPrice,
    priceFeed,
  } = usePriceHistory();
  
  const price = React.useMemo(() => {
    if (hoveringChart) {
      return hoverPrice || priceFeed || 0;
    }
    return priceFeed || hoverPrice || 0;
  }, [hoveringChart, hoverPrice, priceFeed]);

  const timeFrameStartPrice = startPrice;

  const priceDiff = price - timeFrameStartPrice;

  const isLoading = (!price && !timeFrameStartPrice);

  const color = priceDiff > 0 ? '#27AD75' : '#F0616D';
  const arrowText = priceDiff > 0 ? '▲' : '▼';

  return (
    <Grid container spacing={0} direction="column" className="text-md sm:text-xl">
      <Grid item className="capitalize">
        <span>
          {coinName} ({unit}){' '}
        </span>
      </Grid>
      <Grid item>
        <Grid container spacing={1} direction="row">
          <Grid item>
            <Skeleton loading={isLoading} variant="rectangular" width="100%" height="100%">
              <span style={{ color }}>{arrowText}</span>
              <TickerDisplay
                value={price}
                format={'USD'}
                type={'animate'}
              />
            </Skeleton>
          </Grid>
          <Grid item style={{ color }}>
            <Skeleton loading={isLoading} variant="rectangular" width="100%" height="100%">
              {'('}

              <TickerDisplay
                value={(priceDiff / price ) * 100}
                format={'PERCENTAGE'}
                type={'animate'}
              />
              {')'}
            </Skeleton>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
  