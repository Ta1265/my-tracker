import React from 'react';
import { motion } from "framer-motion";
import debounce from 'lodash/debounce';


const formatValue = (val: number| null | undefined, format: 'USD' | 'PERCENTAGE', fracDigits?: number) => {
  const value = val || 0;

  if (!fracDigits && format === 'USD') {
    if (value < 100000) {
      const integerDigits = Math.floor(value).toString().length;
      fracDigits = Math.max(6 - integerDigits, 0);
    }
  }
  if (!fracDigits && format === 'PERCENTAGE') {
    fracDigits = 2;
  }

  let returnVal;
  if (format === 'USD') {
    returnVal = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fracDigits,
      maximumFractionDigits: fracDigits,
    })
  } else {
    returnVal = value.toFixed(fracDigits) + '%';
  }

  // return returnVal.split('').reverse();
  return returnVal.split('');
}


const usePreviousNum = (value: number) => {
  const ref = React.useRef<number>(value);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const usePreviousStr = (value: string) => {
  const ref = React.useRef<string | 0>(0);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

function NonNumberCol({ char }: { char: string }) {
  return (
    <div>
      <span>{char}</span>
    </div>
  );
}

function TickerArrow({ value, showArrow }: { value: number, showArrow: boolean }) {
  const prev = usePreviousNum(value);

  if (!showArrow) return null;

  let color = 'none';
  let arrow = '▲';
  const change = value - prev;

  const hide = change === 0;

  if (showArrow && change > 0) {
    arrow = '▲';
    color = '#27AD75';
  }
  if (showArrow && change < 0) {
    arrow = '▼';
    color = '#F0616D';
  }


  return (
    <div key={change}>
      {}
      <span style={{
        color,
        visibility: hide ? 'visible' : 'hidden',
        animation: 'animateOut 2s ease-out forwards',
      }}>{arrow}&nbsp;</span>
    </div>
  )
}


const numbers = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

const NumberColumn: React.FC<{ digit: string; delta: Delta }> = ({ digit, delta }) => {
  const [position, setPosition] = React.useState(0);
  const previousDigit = usePreviousStr(digit);
  const columnContainer = React.useRef<HTMLDivElement>(null);
  const startAnimation = previousDigit === digit  ? '' : delta === 'increase' ? 'green' : 'red';
  const [animationClass, setAnimationClass] = React.useState<Delta | 'green' | 'red' | ''>(startAnimation);

  // const animationComplete = React.useCallback(
  //   debounce(() => setAnimationClass(''), 500),
  //   [],
  // );


  // const animationComplete = debounce(() => setAnimationClass(''), 500);
  // const animationComplete = () => setAnimationClass('')

  const setColumnToNumber = React.useCallback((number: string) => {
    if (columnContainer?.current?.clientHeight) {
      setPosition(columnContainer?.current?.clientHeight * parseInt(number, 10));
    }
  }, []);

  React.useEffect(() => {
    setAnimationClass(previousDigit !== digit ? delta : '');
  }, [digit, delta]);

  React.useEffect(() => {
    setColumnToNumber(digit);
  }, [digit, setColumnToNumber]);

  return (
    <div className="ticker-column-container" ref={columnContainer}>
      <motion.div
        animate={{ y: position }}
        className={`ticker-column ${animationClass}`}
        onAnimationComplete={() => setAnimationClass('')}
      >
        {numbers.map((num) => (
          <div key={num} className="ticker-digit">
            <span>{num}</span>
          </div>
        ))}
      </motion.div>
      <span className="number-placeholder">0</span>
    </div>
  );
};

NumberColumn.displayName = 'NumberColumn';

const MemoNumberColumn = React.memo(NumberColumn, (prevProps, nextProps) => {
  return prevProps.digit === nextProps.digit && prevProps.delta === nextProps.delta;
});

const MemoTickerArrow = React.memo(TickerArrow, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value && prevProps.showArrow === nextProps.showArrow;
});

const MemoNonNumberCol = React.memo(NonNumberCol, (prevProps, nextProps) => {
  return prevProps.char === nextProps.char;
});

type Delta = 'increase' | 'decrease' | 'none';


interface Props {
  value: number;
  format: 'USD' | 'PERCENTAGE';
  fracDigits?: number;
  showArrow?: boolean 
}

const AnimatingNumber = ({ value, format, fracDigits, showArrow = false }: Props) => {
  const numArray = formatValue(value, format, fracDigits);
  const previousNumber = usePreviousNum(value);

  let delta: Delta = 'none';
  if (value > previousNumber) delta = 'increase';
  if (value < previousNumber) delta = 'decrease';

  return (
    <div className="inline-flex">
      <MemoTickerArrow
        value={value}
        showArrow={showArrow}
      />
      <motion.div layout className="ticker-view ticker-font">
        {numArray.map((digit, index) =>
          Number.isNaN(parseInt(digit)) ? (
            <MemoNonNumberCol key={index} char={digit} />
          ) : (
            <MemoNumberColumn key={index} digit={digit} delta={delta} />
          ),
        )}
      </motion.div>
    </div>
  );
};

export default AnimatingNumber;




