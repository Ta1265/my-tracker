// TableComponent.tsx
import React, { useState } from "react";
import { useTable } from "react-table";
import { motion } from "framer-motion";

interface TableComponentProps {
  columns: any[];
  data: any[];
}

const TableComponent: React.FC<TableComponentProps> = ({ columns, data }) => {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data });

  const handleRowClick = (row: any) => {
    setSelectedRow(selectedRow === row.id ? null : row.id);
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <table {...getTableProps()} className="table-auto border-collapse w-full">
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column) => (
                <th {...column.getHeaderProps()} className="border p-2">
                  {column.render("Header")}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row) => {
            prepareRow(row);
            return (
              <React.Fragment key={row.id}>
                <tr
                  {...row.getRowProps()}
                  onClick={() => handleRowClick(row)}
                  className={`cursor-pointer ${
                    selectedRow === row.id ? "bg-gray-200" : ""
                  }`}
                >
                  {row.cells.map((cell) => (
                    <td {...cell.getCellProps()} className="border p-2">
                      {cell.render("Cell")}
                    </td>
                  ))}
                </tr>
                {selectedRow === row.id && (
                  <motion.tr
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-100"
                  >
                    <td colSpan={columns.length}>
                      {/* Your additional table content goes here */}
                      <div className="p-4">
                        {/* Additional data for the selected row */}
                        Example data for {row.original.name}
                      </div>
                    </td>
                  </motion.tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TableComponent;
