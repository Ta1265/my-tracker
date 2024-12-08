import StatsTable from '../components/StatsTable';
import SummaryTable from '../components/SummaryTable';
import React from 'react';

export default function Stats() {

  return (
    <>
      <div className="mx-auto">
        <div className="flex justify-center py-2"
        style={{
          maxWidth: '900px',
          width: '100%',
        }}>
          <SummaryTable />
        </div>
      </div>

      <br />

      <StatsTable />
    </>
  );
}

Stats.auth = true;
