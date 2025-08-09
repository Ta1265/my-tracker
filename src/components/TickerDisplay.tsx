/** @jsxImportSource @emotion/react */
import React from 'react';
import { css, keyframes } from '@emotion/react';
import AnimatingNumber from './AnimatingNumber';
import { formatValue } from '../utils/formatDollars';

const flashGreen = keyframes`
  0% { opacity: .5; background-color: rgba(39, 173, 117, 0.5); color: white; }
  50% { opacity: .75; background-color: rgba(39, 173, 117, 0.5); color: white; }
  100% { opacity: 1; background-color: inherit; color: inherit; }
`;

const flashRed = keyframes`
  0% { opacity: .5; background-color: rgba(240, 97, 109, 0.5); color: white; }
  50% { opacity: .75; background-color: rgba(240, 97, 109, 0.5); color: white; }
  100% { opacity: 1; background-color: inherit; color: inherit; }
`;

const animateOut = keyframes`
  0% { opacity: 1; visibility: visible; }
  100% { opacity: 0; ; visibility: none; }
`;

const usePrevious = (value: number) => {
  const ref = React.useRef<number>(0);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};

const Ticker: React.FC<{
  value: number;
  format: 'USD' | 'PERCENTAGE';
  showArrow?: boolean;
  fracDigits?: number;
}> = ({ value, format, showArrow = false, fracDigits }) => {
  const prev = usePrevious(value);
  const formattedCur = formatValue(value, format, fracDigits);
  const formattedPrev = formatValue(prev, format, fracDigits);

  let color = 'none';
  let flash = '';
  if (value > prev) {
    color = '#27AD75';
    flash = flashGreen;
  }
  if (value < prev) {
    color = '#F0616D';
    flash = flashRed;
  }

  let shouldFlash = value !== prev;

  const flashFromIndex =
    shouldFlash && formattedPrev.split('').findIndex((char, index) => char !== formattedCur[index]);

  let shouldAnimateArrow: boolean = false;
  if (typeof flashFromIndex === 'number') {
    shouldAnimateArrow = shouldFlash;
  }

  return (
    <span className="ticker-font">
      {showArrow && (
        <span
          key={`${value}-${prev}`}
          css={css`
            animation: ${animateOut} 2s ease-out forwards;
            color: ${color};
            visibility: ${shouldAnimateArrow ? 'visible' : 'hidden'};
            white-space: nowrap;
          `}
        >
          {value > prev ? '▲ ' : '▼ '}
        </span>
      )}

      {formattedCur.split('').map((char, index) => {
        const shouldDigitFlash = flashFromIndex && flashFromIndex <= index;
        return (
          <span
            key={`percent-${index}-${char}`}
            css={css`
              animation: ${shouldDigitFlash ? flash : 'none'} 1s ease-in-out;
            `}
          >
            {char}
          </span>
        );
      })}
      {format === 'PERCENTAGE' && <span>%</span>}
    </span>
  );
};

interface TickerProps {
  value: number;
  format: 'USD' | 'PERCENTAGE';
  fracDigits?: number;
  showArrow?: boolean;
}

interface TickerDisplayProps extends TickerProps {
  type?: 'flash' | 'animate';
}

const TickerDisplay: React.FC<TickerDisplayProps> = ({ type = 'flash', ...restProps }) => {
  if (type === 'animate') {
    return <AnimatingNumber {...restProps} />;
  }
  return <Ticker {...restProps} />;
};

const TickerDisplayMemo = React.memo(TickerDisplay, (prevProps, nextProps) => {
  return prevProps.type === nextProps.type;
});

export default TickerDisplay;
