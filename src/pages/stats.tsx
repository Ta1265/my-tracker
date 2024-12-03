import StatsTable from '../components/StatsTable';
import SummaryTable from '../components/SummaryTable';
import React from 'react';

export default function Stats() {

  return (
    <>
      <div className="mx-auto">
        <div className="flex justify-center py-3 sm:py-4">
          <SummaryTable />
        </div>
      </div>

      <br />

      <StatsTable />
    </>
  );
}

Stats.auth = true;
