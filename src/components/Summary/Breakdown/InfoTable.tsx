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
    <div
      className="
      flex-col
      px-2 py-2
    "
    >
      <table
        className="
        table-auto
        cursor-pointer
        text-xs
        md:text-base
      "
      >
        <tbody
          className="
          justify-between
          px-2
          py-2 
          text-base 
          text-gray-700
          text-gray-700
          dark:text-gray-400
        "
        >
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
              <tr key={row.label} className={row.end ? 'border-t' : ''}>
                <td className="pr-4 text-right">{row.label}</td>
                <td>{row.sign}</td>
                <td>{val}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};