import StatsTable from '../components/StatsTable';
import SummaryTable from '../components/Summary/SummaryTable';
import React from 'react';
import { StatsTableProvider } from '../context/StatsTableContext';

export default function Stats() {
  return (
    <StatsTableProvider>
      {/* <div className="mx-auto"> */}
        <div
          className="flex justify-center py-2"
          style={{
            maxWidth: '900px',
            width: '100%',
          }}
        >
          <SummaryTable
          />
        </div>
      {/* </div> */}

      <StatsTable/>
    </StatsTableProvider>
  );
}

Stats.auth = true;
