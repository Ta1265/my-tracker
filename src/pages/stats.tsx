import StatsTable from '../components/StatsTable';
import SummaryTable from '../components/SummaryTable';
import React from 'react';
import { StatsTableProvider } from '../context/StatsTableContext';
// import { type TimeFrame } from './product/TimeFrameSelect';

export default function Stats() {
  // const [selectedTimeFrame, setSelectedTimeFrame] = React.useState<TimeFrame>('d');

  // const { data: , isPending: timeFramePlPending } = useQuery({
  //   queryKey: ['total-pl', selectedTimeFrame],
  //   queryFn: async ({ signal }): Promise<number> => {
  //     const resp = await fetch(`/api/change/${selectedTimeFrame}`, { signal });
  //     if (!resp.ok) {
  //       throw new Error('Network response error');
  //     }
  //     return resp.json();
  //   },
  // });

  return (
    <StatsTableProvider>
      <div className="mx-auto">
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
      </div>

      <br />

      <StatsTable 
      />
    </StatsTableProvider>
  );
}

Stats.auth = true;
