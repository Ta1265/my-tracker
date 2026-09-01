import {
  UseSortByColumnOptions,
  UseSortByColumnProps,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
} from 'react-table';

declare module 'react-table' {
  interface TableOptions<D extends object> extends UseSortByOptions<D> {}

  interface TableInstance<D extends object> extends UseSortByInstanceProps<D> {}

  interface TableState<D extends object> extends UseSortByState<D> {}

  interface ColumnInterface<D extends object = {}> extends UseSortByColumnOptions<D> {
    myWidth?: string;
    styles?: React.CSSProperties;
    title?: string;
    Filter?: () => JSX.Element;
  }

  interface ColumnInstance<D extends object = {}> extends UseSortByColumnProps<D> {}
}
