import React from 'react';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { visuallyHidden } from '@mui/utils';
import Box from '@mui/joy/Box';
import Link from '@mui/joy/Link';

const SortArrow: React.FC<{
  isSorted: boolean;
  isSortedDesc: boolean;
  children: React.ReactNode;
}> = ({ isSorted, isSortedDesc, children }) => {
  return (
    <Link
      className="align-content-center text-center uppercase"
      underline="none"
      color="neutral"
      textColor={isSorted ? 'primary.plainColor' : undefined}
      component="button"
      // onClick={createSortHandler(headCell.id)}
      fontWeight="lg"
      startDecorator={
        isSorted ? (
          <ArrowDownwardIcon sx={{ opacity: isSorted ? 1 : 0 }} />
        ) : null
      }
      sx={{
        '& svg': {
          transition: '0.2s',
          transform:
            isSorted && isSortedDesc ? 'rotate(0deg)' : 'rotate(180deg)',
        },
        '&:hover': { '& svg': { opacity: 1 } },
      }}
    >
      {children}
      {isSorted ? (
        <Box component="span" sx={visuallyHidden}>
          {isSortedDesc ? 'sorted descending' : 'sorted ascending'}
        </Box>
      ) : null}
    </Link>
  );
};

export default SortArrow;
