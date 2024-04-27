import { createContext } from 'react';
import { useState } from 'react';
import Snackbar from '@mui/joy/Snackbar';
import { CssVarsProvider, extendTheme } from '@mui/joy';
import Button from '@mui/joy/Button';
import {
  PlaylistAddCheckCircleRounded,
  PlaylistRemoveRounded,
} from '@mui/icons-material';
import { color } from 'framer-motion';

const baseTheme = extendTheme();
const darkOnlyTheme = extendTheme({
  colorSchemes: {
    light: baseTheme.colorSchemes.dark,
    dark: baseTheme.colorSchemes.dark,
  },
});

type toastProps = {
  message?: string;
  color?: 'primary' | 'neutral' | 'danger' | 'success' | 'warning';
  anchorVertical?: 'top' | 'bottom';
  anchorHorizontal?: 'center' | 'left' | 'right';
  autoHideDuration?: number;
};

interface SnackbarContextProps {
  // message: string;
  open: boolean;
  // color: 'primary' | 'neutral' | 'danger' | 'success' | 'warning';
  // anchorVertical: 'top' | 'bottom';
  // anchorHorizontal: 'center' | 'left' | 'right';
  toastSuccess: ({
    message,
    color,
    anchorVertical,
    anchorHorizontal,
    autoHideDuration,
  }: toastProps) => void;
  toastError: ({
    message,
    color,
    anchorVertical,
    anchorHorizontal,
    autoHideDuration,
  }: toastProps) => void;
  toastWarning: ({
    message,
    color,
    anchorVertical,
    anchorHorizontal,
    autoHideDuration,
  }: toastProps) => void;
  closeSnackbar: () => void;
}

export const SnackbarContext = createContext<SnackbarContextProps>({
  open: false,
  toastSuccess: ({}: toastProps) => {},
  toastError: ({}: toastProps) => {},
  toastWarning: ({}: toastProps) => {},
  closeSnackbar: () => {},
});

// export const SnackbarContext = createContext<SnackbarContextProps | undefined>(
//   undefined,
// );

export const SnackbarProvider: React.FC<any> = ({ children }) => {
  const [open, setOpen] = useState(false);

  const [toastProps, setToastProps] = useState<{
    message: string;
    color: 'primary' | 'neutral' | 'danger' | 'success' | 'warning';
    anchorVertical: 'top' | 'bottom';
    anchorHorizontal: 'center' | 'left' | 'right';
    autoHideDuration: number;
  }>({
    message: 'Success!',
    color: 'success',
    anchorVertical: 'top',
    anchorHorizontal: 'center',
    autoHideDuration: 6000,
  });

  const toastSuccess = ({
    message = 'Success!',
    color = 'success',
    anchorVertical = 'top',
    anchorHorizontal = 'center',
    autoHideDuration = 6000,
  }: toastProps) => {
    setToastProps({
      message,
      color,
      anchorVertical,
      anchorHorizontal,
      autoHideDuration,
    });
    setOpen(true);
  };

  const toastError = ({
    message = 'Error!',
    color = 'danger',
    anchorVertical = 'top',
    anchorHorizontal = 'center',
    autoHideDuration = 6000,
  }: toastProps) => {
    setToastProps({
      message,
      color,
      anchorVertical,
      anchorHorizontal,
      autoHideDuration,
    });
    setOpen(true);
  };

  const toastWarning = ({
    message = 'Warning!',
    color = 'warning',
    anchorVertical = 'top',
    anchorHorizontal = 'center',
    autoHideDuration = 6000,
  }: toastProps) => {
    setToastProps({
      message,
      color,
      anchorVertical,
      anchorHorizontal,
      autoHideDuration,
    });
    setOpen(true);
  };

  const closeSnackbar = () => {
    setOpen(false);
  };

  return (
    <SnackbarContext.Provider
      value={{
        open,
        toastSuccess,
        toastError,
        toastWarning,
        closeSnackbar,
        // ...toastProps,
      }}
    >
      {children}
      <CssVarsProvider theme={darkOnlyTheme}>
        <Snackbar
          color={toastProps.color}
          open={open}
          autoHideDuration={toastProps.autoHideDuration}
          onClose={closeSnackbar}
          anchorOrigin={{
            vertical: toastProps.anchorVertical,
            horizontal: toastProps.anchorHorizontal,
          }}
          variant="outlined"
          size="lg"
          startDecorator={
            <>
              {(() => {
                if (toastProps.color === 'success') {
                  return <PlaylistAddCheckCircleRounded />;
                }
                if (toastProps.color === 'danger') {
                  return <PlaylistRemoveRounded />;
                }
              })()}
            </>
          }
          endDecorator={
            <Button
              onClick={() => setOpen(false)}
              size="sm"
              variant="outlined"
              color={toastProps.color}
            >
              Dismiss
            </Button>
          }
        >
          {toastProps.message}
        </Snackbar>
      </CssVarsProvider>
    </SnackbarContext.Provider>
  );
};
