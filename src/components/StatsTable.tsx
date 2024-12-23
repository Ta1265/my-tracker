import type { Column } from 'react-table';
import React from 'react';
import { DeltaCellMemo, DeltaHeaderMemo, DeltaSelectFilterMemo } from './stats-table/DeltaColumn';
import type { CoinSummaryResp } from '../../types/global';
import CurrentPrice from './stats-table/CurrentPrice';
import { ProfitLossCell, ProfitLossFilter, ProfitLossHeader } from './stats-table/ProfitLossColumn';
import { HoldingsCell } from './stats-table/HoldingsColumn';
import { CostBasisCell } from './stats-table/CostBasisColumn';
import { CoinColumnCell } from './stats-table/CoinColumn';
import StatsTableComponent from './stats-table/StatsTableComponent';
import { useCoinSummaries } from '../_hooks/useCoinSummaries';
import Image from 'next/image';


export default function StatsTable() {
  const { data = [], isPending } = useCoinSummaries();

  const statsColumns: Column<CoinSummaryResp>[] = React.useMemo(
    () => [
      {
        Header: ' ',
        myWidth: '35px',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <Image
            src={`/${cell.value.productName}-icon.png`}
            alt={cell.value.productName}
            width={30}
            height={30}
          />
        ),
      },
      {
        Header: 'Coin',
        myWidth: '90px',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <CoinColumnCell coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const a = rowA.values[columnId].productName;
          const b = rowB.values[columnId].productName;
          return a > b ? 1 : -1;
        },
      },
      {
        Header: 'Holdings',
        // myWidth: '120px',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <HoldingsCell coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].valueOfHoldings;
          const bNum = rowB.values[columnId].valueOfHoldings;
          return aNum - bNum;
        },
      },
      {
        Header: 'Cost Basis',
        title: 'Cost Basis / Break Even',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <CostBasisCell coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].costBasis;
          const bNum = rowB.values[columnId].costBasis;
          return aNum - bNum;
        },
      },
      {
        Header: 'Current Price',
        myWidth: '135px',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <CurrentPrice coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].currentPrice;
          const bNum = rowB.values[columnId].currentPrice;
          return aNum - bNum;
        },
      },
      {
        Header: <DeltaHeaderMemo />,
        id: 'delta',
        myWidth: '100px',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <DeltaCellMemo coinSummary={cell.value} />
        ),
        Filter: () => <DeltaSelectFilterMemo />,
      },
      {
        Header: <ProfitLossHeader />,
        id: 'total',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <ProfitLossCell coinSummary={cell.value} />
        ),
        Filter: () => <ProfitLossFilter />,
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].profitLossAtCurrentPrice;
          const bNum = rowB.values[columnId].profitLossAtCurrentPrice;
          return aNum - bNum;
        },
      },
    ],
    [],
  );

  return <StatsTableComponent data={data} columns={statsColumns} />;
};

