import StatsTable from '../components/StatsTable';
import SummaryTable from '../components/Summary/SummaryTable';
import React from 'react';
import { StatsTableProvider } from '../context/StatsTableContext';
import ClientLoader from '../components/ClientLoader';

export default function Stats() {
  return (
    <ClientLoader>
      <StatsTableProvider>
        <div
          className="flex justify-center py-2"
          style={{
            maxWidth: '900px',
            width: '100%',
          }}
        >
          <SummaryTable />
        </div>

        <StatsTable />
      </StatsTableProvider>
    </ClientLoader>
  );
}

Stats.auth = true;
