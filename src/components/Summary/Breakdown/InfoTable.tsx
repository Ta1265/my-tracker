'use client';

import React from 'react';

interface intoTableRow {
  label: string;
  sign: string;
  value: number;
  end?: boolean;
  type?: 'PERCENTAGE' | 'USD';
}

interface InfoTableProps {
  rows: intoTableRow[];
}
export const InfoTable: React.FC<InfoTableProps> = ({ rows }) => {
  return (
    <div className="px-3 py-2">
      <table className="table-auto text-xs md:text-sm">
        <tbody>
          {rows.map((row) => {
            const val =
              row.type === 'PERCENTAGE'
                ? `${row.value.toFixed(2)}%`
                : row.value.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0,
                  });
            return (
              <tr
                key={row.label}
                style={{
                  borderTop: row.end ? '1px solid var(--border-medium)' : undefined,
                }}
              >
                <td
                  className="pr-4 py-0.5 text-right"
                  style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}
                >
                  {row.label}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{row.sign}</td>
                <td
                  className="font-medium"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'Roboto Mono, monospace',
                  }}
                >
                  {val}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};