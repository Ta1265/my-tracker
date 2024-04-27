import React, { useMemo, useEffect, useState } from 'react';
import { useReload } from '../context/ReloadContext';

export const useGetStats = () => {
  const { reload } = useReload();
  const [stats, setStats] = useState<FormattedProductStats[]>([]);
  const [summary, setSummary] = useState<StatsSummary[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/stats/all')
      .then((res) => res.json())
      .then(({ stats, summary }) => {
        setStats(stats);
        setSummary(summary);
        setLoading(false);
      });
  }, [reload]);

  return { stats, summary, isLoading };
};
