import React from 'react';
import type { CoinSummaryResp } from '../../../types/global';
import Image from 'next/image';

export const CoinColumnCell: React.FC<{
  coinSummary: CoinSummaryResp;
}> = ({ coinSummary }) => {

  return (
    <div
      className="flex items-center text-center"
      // style={{
      //   position: 'sticky',
      //   background: 'inherit',
      //   justifyContent: 'left',
      // }}
    >
      <Image
        src={`/${coinSummary.productName}-icon.png`}
        alt={coinSummary.productName}
        width={30}
        height={30}
      />
      <span className="ml-2"> {coinSummary.coinName}</span>
    </div>
  );
};