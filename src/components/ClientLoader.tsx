import React from 'react';
import { useStorePriceHistory } from '../_hooks/useStorePriceHistory';
import { Spinner } from 'flowbite-react';
import { Box } from '@mui/material';


export default function ClientLoader({ children }: { children: React.ReactNode }) {
  const { isPending } = useStorePriceHistory();

  if (isPending) {
    return (
      <Box display="flex" flexDirection={"column"} justifyContent="center" alignItems="center" height="50vh" gap="20px">
        <Spinner size="xl" aria-label="Loading spinner" className="mt-10" />
        <Box ml={2}>Loading your data...</Box>
      </Box>
    );
  }


  return <>{children}</>;
}