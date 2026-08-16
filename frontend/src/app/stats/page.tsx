'use client';

import StatsTable from '@/components/StatsTable';
import SummaryLayout from '@/components/Summary/SummaryLayout';
import React from 'react';
import { StatsTableProvider } from '@/context/StatsTableContext';
import ClientLoader from '@/components/ClientLoader';

export default function Stats() {
  return (
    <ClientLoader>
      <StatsTableProvider>
        <div
          className="flex justify-center py-4"
          style={{ maxWidth: '960px', width: '100%' }}
        >
          <SummaryLayout />
        </div>
        <div style={{ maxWidth: '960px', width: '100%' }}>
          <StatsTable />
        </div>
      </StatsTableProvider>
    </ClientLoader>
  );
}
