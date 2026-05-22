import 'react-table';

declare module 'react-table' {
  interface ColumnInterface<D extends object = {}> {
    myWidth?: string;
    title?: string;
    Filter?: () => JSX.Element;
    sortType?: string | ((rowA: any, rowB: any, columnId: string, desc?: boolean) => number);
  }
}
