/** @jsxImportSource @emotion/react */
import React from 'react';
import { css, keyframes } from '@emotion/react';

const flashGreen = keyframes`
  0% { opacity: .5; transform: translateY(-100%); background-color: rgba(39, 173, 117, 0.5); color: white; }
  50% { opacity: .75; transform: translateY(-50%); background-color: rgba(39, 173, 117, 0.5); color: white; }
  100% { opacity: 1; transform: translateY(0); background-color: inherit; color: inherit; }
`;

const flashRed = keyframes`
  0% { opacity: .5; transform: translateY(100%); background-color: rgba(240, 97, 109, 0.5); color: white; }
  50% { opacity: .75; transform: translateY(50%); background-color: rgba(240, 97, 109, 0.5); color: white; }
  100% { opacity: 1;  transform: translateY(0); background-color: inherit; color: inherit; }
`;

const animateOut = keyframes`
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-100%); visibility: none; }
`;

const TickerDisplay: React.FC<{ cur: number; format: 'USD' | 'PERCENTAGE', showArrow?: boolean }> = ({
  cur,
  format,
  showArrow = true,
}) => {
  const prevRef = React.useRef<number | null>(cur);
  const prev = prevRef.current || cur;
  prevRef.current = cur;

  const formattedCur = format === 'USD' ? cur.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : cur.toFixed(2);

  const formattedPrev =
    format === 'USD'
      ? prev.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : prev.toFixed(2);

  const color = cur > prev ? '#27AD75' : '#F0616D';
  const flash = cur > prev ? flashGreen : flashRed;

  const shouldFlash = cur !== prev;
  
  return (
    <>
      {showArrow && (
        <span
          key={`${cur}-${prev}`}
          css={css`
            font-family: 'Roboto Mono', monospace;
            animation: ${animateOut} 2s ease-out forwards;
            color: ${color};
            visibility: ${shouldFlash ? 'visible' : 'hidden'};
          `}

        >
          {cur > prev ? '▲ ' : '▼ '}
        </span>
      )}
      {formattedCur.split('').map((char, index) => {
        const shouldDigitFlash = shouldFlash && formattedPrev.split('').some((_, i) => i <= index && formattedCur[i] !== formattedPrev[i]);
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