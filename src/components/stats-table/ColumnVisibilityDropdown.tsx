'use client';

import React, { useState } from 'react';
import Dropdown from '@mui/joy/Dropdown';
import MenuButton from '@mui/joy/MenuButton';
import Menu from '@mui/joy/Menu';
import MenuItem from '@mui/joy/MenuItem';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useStatsTableContext } from '../../context/StatsTableContext';

const COLUMN_LABEL: Record<string, string> = {
  coin: 'Coin',
  holdings: 'Holdings',
  costBasis: 'Cost Basis',
  currentPrice: 'Current Price',
  delta: 'Delta',
  total: 'P/L',
};

export const ColumnVisibilityDropdown: React.FC = () => {
  const { columns, toggleColumn, moveColumn } = useStatsTableContext();
  const [open, setOpen] = useState(false);

  return (
    <Dropdown open={open} onOpenChange={(_, isOpen) => setOpen(isOpen)}>
      <MenuButton
        slots={{ root: 'span' }}
        sx={{
          border: 0,
          padding: 0,
          background: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          minHeight: 'unset',
          '&:hover': { background: 'none' },
        }}
      >
        <KeyboardArrowDownIcon fontSize="small" />
      </MenuButton>
      <Menu sx={{ zIndex: 9999 }}>
        {columns.map(([id, visible], idx) => (
          <MenuItem
            key={id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              minHeight: '48px',
              '&:hover': { background: 'var(--bg-table-hover)' },
            }}
          >
            <ArrowUpwardIcon
              fontSize="inherit"
              onClick={(e) => {
                e.stopPropagation();
                moveColumn(id);
              }}
              style={{
                cursor: idx === 0 ? 'default' : 'pointer',
                opacity: idx === 0 ? 0.2 : 0.6,
                fontSize: '18px',
                flexShrink: 0,
              }}
            />
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleColumn(id);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', fontSize: '15px' }}
            >
              {visible ? (
                <CheckBoxIcon className="text-blue-400" fontSize="medium" />
              ) : (
                <CheckBoxOutlineBlankIcon className="text-gray-600" fontSize="medium" />
              )}
              <span style={{ color: 'var(--text-secondary)' }}>{COLUMN_LABEL[id]}</span>
            </span>
          </MenuItem>
        ))}
      </Menu>
    </Dropdown>
  );
};
