/** @jsxImportSource @emotion/react */
import React from 'react';
import { css, keyframes } from '@emotion/react';

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

const TickerDisplay: React.FC<{
  cur: number;
  format: 'USD' | 'PERCENTAGE';
  showArrow?: boolean;
  fracDigits?: number;
  shouldAnimate?: boolean;
  constantArrow?: boolean;
}> = ({ cur, format, showArrow = true, fracDigits, shouldAnimate = true, constantArrow = false }) => {
  const prevRef = React.useRef<number | null>(cur);
  const prev = prevRef.current || cur;
  prevRef.current = cur;

  if (!fracDigits && format === 'USD') {
    if (cur < 100000) {
      const integerDigits = Math.floor(cur).toString().length;
      fracDigits = Math.max(6 - integerDigits, 0);
    }
  }
  if (!fracDigits && format === 'PERCENTAGE') {
    fracDigits = 2;
  }

  const formattedCur =
    format === 'USD'
      ? cur.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: fracDigits,
          maximumFractionDigits: fracDigits,
        })
      : cur.toFixed(fracDigits);

  const formattedPrev =
    format === 'USD'
      ? prev.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: fracDigits,
          maximumFractionDigits: fracDigits,
        })
      : prev.toFixed(fracDigits);

  const color = cur > prev ? '#27AD75' : '#F0616D';
  const flash = cur > prev ? flashGreen : flashRed;

  let shouldFlash = shouldAnimate && cur !== prev;

  const flashFromIndex =
    shouldFlash && formattedPrev.split('').findIndex((char, index) => char !== formattedCur[index]);
 
  let shouldAnimateArrow: boolean = false
  // if (typeof flashFromIndex === 'number') {
    shouldAnimateArrow = shouldFlash;
  // }
  const animation = `${constantArrow ? '' : `${animateOut} 2s ease-out forwards`}`;

  return (
    <>
      {(showArrow || constantArrow) && (
        <span
          key={`${cur}-${prev}`}
          css={css`
            font-family: 'Roboto Mono', monospace;
            animation: ${animateOut} 2s ease-out forwards; 
            color: ${color};
            visibility: ${constantArrow || shouldAnimateArrow ? 'visible' : 'hidden'};
            white-space: nowrap;
          `}
        >
          {cur > prev ? '▲ ' : '▼ '}
        </span>
      )}
      {formattedCur.split('').map((char, index) => {
        // const shouldDigitFlash = shouldFlash && formattedPrev.split('').some((_, i) => i <= index && formattedCur[i] !== formattedPrev[i]);
        const shouldDigitFlash = flashFromIndex && flashFromIndex <= index;
        return (
          <span
            key={`percent-${index}-${char}`}
            css={css`
              font-family: 'Roboto Mono', monospace;
              animation: ${shouldDigitFlash ? flash : 'none'} 1s ease-in-out;
            `}
          >
            {char}
          </span>
        );
      })}
      {format === 'PERCENTAGE' && <span>%</span>}
    </>
  );
};

export default TickerDisplay;