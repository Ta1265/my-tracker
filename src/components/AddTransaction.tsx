import { DateTimePicker } from '@mui/x-date-pickers';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import dayjs from 'dayjs';
import React, { useState, useContext } from 'react';
import Modal from 'react-modal';
import Select from 'react-select';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useReload } from '../context/ReloadContext';
import { SnackbarContext } from '../context/SnackBarContext';
import { useGetTokenList } from '../_hooks/useGetTokenList';

Modal.setAppElement('#__next');

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.7)',
    },
  },
  '& input:focus': {
    borderColor: 'rgba(255, 255, 255, 0.7)',
    outline: 'none',
    boxShadow: 'none',
  },
  '& input': {
    backgroundColor: 'transparent',
  },
  '& label:not(.Mui-focused)': {
    transform: 'translate(14px, 7px) scale(1)',
  },
};

const theme = createTheme({
  palette: {
    mode: 'dark', // This makes it use dark mode colors
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

const getDefaultFormValue = () => ({
  coin: {
    value: null as number | null,
    errors: [] as Array<string>,
  },
  dateOfTransaction: {
    value: null as dayjs.Dayjs | null,
    errors: [] as Array<any>,
  },
  side: {
    value: 'buy',
    errors: [] as Array<string>,
  },
  size: {
    value: '',
    errors: [] as Array<string>,
  },
  price: {
    value: '',
    errors: [] as Array<string>,
  },
  fee: {
    value: '',
    errors: [] as Array<string>,
  },
  total: {
    value: '',
    errors: [] as Array<string>,
  },
  notes: {
    value: '',
    errors: [] as Array<string>,
  },
});

const AddTransaction: React.FC<{
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}> = ({ isOpen, setIsOpen }) => {
  const snackBarCtx = useContext(SnackbarContext);
  const { triggerReload } = useReload();
  const [formValues, setFormValues] = useState(getDefaultFormValue());
  // const [formTotal, setFormTotal] = useState(null as number | null);

  // const [coinSearchValue, setCoinSearchValue] = useState('');

  const { coinOptions, isLoading, setCoinSearchValue, coinSearchValue } =
    useGetTokenList();

  const coinOnChange = (option: any) => {
    if (!option || !option.value) {
      return setFormValues({
        ...formValues,
        coin: {
          value: null,
          errors: ['Coin is required.'],
        },
      });
    }
    setFormValues({
      ...formValues,
      coin: {
        value: option.value.token_id,
        errors: [],
      },
    });
    // setCoinSearchValue(option.value.name);
  };

  const validateForm = () => {
    let isValid = true;
    const newFormValues = { ...formValues };

    if (!newFormValues.coin.value) {
      isValid = false;
      newFormValues.coin.errors = ['Coin Name is required.'];
    }
    if (!newFormValues.size.value.length) {
      isValid = false;
      newFormValues.size.errors = ['Size is required.'];
    }
    if (!newFormValues.price.value.length) {
      isValid = false;
      newFormValues.price.errors = ['Price is required.'];
    }
    if (!newFormValues.fee.value.length) {
      isValid = false;
      newFormValues.fee.errors = ['Fee is required.'];
    }
    if (!newFormValues.dateOfTransaction.value) {
      isValid = false;
      newFormValues.dateOfTransaction.errors = ['Date is required.'];
    }
    setFormValues(newFormValues);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
      snackBarCtx.toastError({
        message: 'Invalid Fields. Please check the form.',
      });
      return;
    }
    fetch('/api/transaction/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        side: formValues.side.value,
        token_id: formValues.coin.value,
        size: formValues.size.value,
        price: formValues.price.value,
        fee: formValues.fee.value,
        date: formValues.dateOfTransaction.value?.toISOString(),
        notes: formValues.notes.value,
      }),
    })
      .then((resp) => {
        snackBarCtx.toastSuccess({
          message: 'Transaction added successfully.',
        });
        console.log({ resp });
        setIsOpen(false);
        triggerReload();
        setFormValues(getDefaultFormValue());
      })
      .catch((error) => {
        console.error(error);
        snackBarCtx.toastError({
          message: 'Failed to add transaction.',
        });
      });
  };

  const closeModal = () => {
    setFormValues(getDefaultFormValue());
    setIsOpen(false);
  };


  const calcTotal = () => {
    if (
      formValues.size.value.length &&
      formValues.price.value.length &&
      formValues.fee.value.length
    ) {
      let total =
        parseFloat(formValues.price.value) * parseFloat(formValues.size.value);
      if (formValues.side.value === 'buy') {
        total += parseFloat(formValues.fee.value);
      } else {
        total -= parseFloat(formValues.fee.value);
      }
      return total;
    }
    return '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={closeModal}
      shouldCloseOnOverlayClick={false}
      contentLabel="Add Transaction"
      className="bg-text-gray-400 flex items-center justify-center bg-opacity-100 outline-none"
      overlayClassName="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75"
      style={{
        overlay: {
          zIndex: 99,
        },
        content: {
          width: '80%',
          maxHeight: '90%',
          maxWidth: '600px',
          borderRadius: '0.5rem', // rounded corners
          // backgroundColor: '#1F2937', // background color
          backgroundColor: 'black',
          padding: '2rem', // padding
          zIndex: 75, // make sure it's on top of the table
          border: '3px solid #2D3748',
        },
      }}
    >
      <ThemeProvider theme={theme}>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="mb-5 ">
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="center"
            >
              <Typography>Buy</Typography>
              <Switch
                checked={formValues.side.value === 'sell'}
                onChange={(e) => {
                  setFormValues({
                    ...formValues,
                    side: {
                      value: e.target.checked ? 'sell' : 'buy',
                      errors: [],
                    },
                  });
                }}
              />
              <Typography>Sell</Typography>
            </Stack>
          </div>

          <div className="mb-5">
            <div className="mb-5">
              <div style={{ width: '270px' }}>
                <DateTimePicker
                  label="Date of Transaction"
                  onError={(error) => {
                    setFormValues({
                      ...formValues,
                      dateOfTransaction: {
                        value: null,
                        errors: [error],
                      },
                    });
                  }}
                  onChange={(value) => {
                    if (!value) {
                      return setFormValues({
                        ...formValues,
                        dateOfTransaction: {
                          value: null,
                          errors: ['Date is required.'],
                        },
                      });
                    }
                    return setFormValues({
                      ...formValues,
                      dateOfTransaction: {
                        value: value,
                        errors: [],
                      },
                    });
                  }}
                  sx={{
                    '& Input': {
                      backgroundColor: 'transparent',
                    },
                    '& label:not(.Mui-focused)': {
                      transform: 'translate(14px, 7px) scale(1)',
                    },
                  }}
                  // referenceDate={dayjs()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: formValues.dateOfTransaction.errors?.[0],
                      error: !!formValues.dateOfTransaction.errors?.length,
                    },
                  }}
                />
              </div>
            </div>

            <div className="mb-5">
              {coinOptions && (
                <Select
                  className={`
                  fb-col-8 
                  capitalize
                  ${formValues.coin.errors.length > 0 ? 'error' : ''}
                `}
                  value={coinOptions.find(
                    (option) => option.value.token_id === formValues.coin.value,
                  )}
                  onChange={coinOnChange}
                  options={coinOptions}
                  onInputChange={(value) => setCoinSearchValue(value)}
                  menuIsOpen={coinSearchValue.length > 0}
                  isSearchable
                  placeholder="Coin Name..."
                  styles={{
                    control: (provided, state) => ({
                      ...provided,
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      backgroundColor: 'black',
                      color: '#F3F4F6',
                      borderColor: formValues.coin.errors.length
                        ? '#f44336'
                        : '#4B5563',
                      '&:hover': {
                        borderColor: '#4B5563',
                      },
                      boxShadow: 'none',
                    }),
                    menu: (provided) => ({
                      ...provided,
                      backgroundColor: '#1F2937',
                      borderColor: '#4B5563',
                      zIndex: 999,
                    }),
                    option: (provided, state) => ({
                      ...provided,
                      color: state.isSelected ? '#F3F4F6' : '#9CA3AF',
                      zIndex: 999,
                      backgroundColor: state.isSelected ? '#374151' : '#111111',
                    }),
                    singleValue: (provided) => ({
                      ...provided,
                      color: '#F3F4F6',
                    }),
                    input: (provided) => ({
                      ...provided,
                      color: '#F3F4F6',
                      outline: 'none',
                      boxShadow: 'none',
                    }),
                  }}
                />
              )}
              {formValues.coin.errors.length > 0 && (
                <div
                  className="error-message"
                  style={{
                    color: '#f44336',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    marginLeft: '14px',
                  }}
                >
                  {formValues.coin.errors.join(', ')}
                </div>
              )}
            </div>

            <div className="mb-5">
              <TextField
                autoComplete="off"
                style={{ width: '270px' }}
                sx={textFieldSx}
                error={formValues.size.errors.length > 0}
                helperText={formValues.size.errors.join(', ')}
                className="w-full h-full"
                id="outlined-basic"
                label="size"
                variant="outlined"
                inputProps={{
                  pattern: '\\d*\\.?\\d*',
                  min: '0',
                  step: '0.00000001',
                }}
                InputProps={{
                  classes: {
                    root: 'translate(14px, 14px) scale(1)',
                  },
                  ...(formValues.size.value?.length && {
                    startAdornment: (
                      <InputAdornment position="start">
                        {formValues.side.value === 'buy' ? (
                          <AddIcon />
                        ) : (
                          <RemoveIcon />
                        )}
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        {formValues.coin.value || 'Coins'}
                      </InputAdornment>
                    ),
                  }),
                }}
                value={formValues.size.value}
                onChange={(e) => {
                  let inputValue = e.target.value;
                  if (inputValue === '') {
                    return setFormValues({
                      ...formValues,
                      size: {
                        value: '',
                        errors: ['Size is required.'],
                      },
                    });
                  }

                  if (inputValue.startsWith('.')) {
                    inputValue = '0' + inputValue;
                  }

                  if (!/^(\d+\.?\d*|\.\d+)$/.test(inputValue)) {
                    return;
                  }

                  setFormValues({
                    ...formValues,
                    size: {
                      value: inputValue,
                      errors: [],
                    },
                  });
                }}
              />
            </div> 

            <div className="mb-5">
              <TextField
                autoComplete="off"
                style={{ width: '270px' }}
                sx={textFieldSx}
                error={formValues.price.errors.length > 0}
                helperText={formValues.price.errors.join(', ')}
                className="w-full"
                id="outlined-basic"
                label="Price"
                variant="outlined"
                inputProps={{
                  pattern: '\\d*\\.?\\d*',
                  min: '0',
                  step: '0.00000001',
                }}
                InputProps={{
                  ...(formValues.price.value?.length && {
                    endAdornment: (
                      <InputAdornment position="end">USD</InputAdornment>
                    ),
                  }),
                }}
                value={formValues.price.value}
                onChange={(e) => {
                  let inputValue = e.target.value;
                  if (inputValue === '') {
                    return setFormValues({
                      ...formValues,
                      price: {
                        value: '',
                        errors: ['Price is required.'],
                      },
                    });
                  }

                  if (inputValue.startsWith('.')) {
                    inputValue = '0' + inputValue;
                  }

                  if (!/^(\d+\.?\d*|\.\d+)$/.test(inputValue)) {
                    return;
                  }

                  setFormValues({
                    ...formValues,
                    price: {
                      value: inputValue,
                      errors: [],
                    },
                  });
                }}
              />
            </div>

            <div className="mb-5">
              <TextField
                autoComplete="off"
                style={{ width: '270px' }}
                sx={textFieldSx}
                error={formValues.fee.errors.length > 0}
                helperText={formValues.fee.errors.join(', ')}
                className="w-full"
                id="outlined-basic"
                label="Fee"
                variant="outlined"
                value={formValues.fee.value}
                InputProps={{
                  ...(formValues.fee.value?.length && {
                    startAdornment: (
                      <InputAdornment position="start">
                        <RemoveIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">USD</InputAdornment>
                    ),
                  }),
                }}
                onChange={(e) => {
                  let inputValue = e.target.value;
                  if (inputValue === '') {
                    return setFormValues({
                      ...formValues,
                      fee: {
                        value: '',
                        errors: ['Fee is required.'],
                      },
                    });
                  }

                  if (inputValue.startsWith('.')) {
                    inputValue = '0' + inputValue;
                  }

                  if (!/^(\d+\.?\d*|\.\d+)$/.test(inputValue)) {
                    return;
                  }

                  setFormValues({
                    ...formValues,
                    fee: {
                      value: inputValue,
                      errors: [],
                    },
                  });
                }}
              />
            </div>
            <div className="mb-5">
              <TextField
                autoComplete="off"
                // disabled={true}
                style={{ width: '270px' }}
                sx={textFieldSx}
                error={formValues.total.errors.length > 0}
                helperText={formValues.total.errors.join(', ')}
                className="w-full"
                id="outlined-basic"
                label="Total"
                variant="outlined"
                InputProps={{
                  ...(formValues.size.value?.length &&
                    formValues.price.value?.length &&
                    formValues.fee.value?.length && {
                      startAdornment: (
                        <InputAdornment position="start">
                          {formValues.side.value === 'buy' ? (
                            <RemoveIcon />
                          ) : (
                            <AddIcon />
                          )}
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">USD</InputAdornment>
                      ),
                    }),
                }}
                value={calcTotal()?.toLocaleString('en-US')}
              />
            </div>

            <div className="mb-5">
              <TextField
                autoComplete="off"
                style={{ width: '270px' }}
                sx={textFieldSx}
                error={formValues.notes.errors.length > 0}
                helperText={formValues.notes.errors.join(', ')}
                className="w-full"
                id="outlined-basic"
                label="Notes"
                variant="outlined"
                onChange={(e) => {
                  e.preventDefault();
                  setFormValues({
                    ...formValues,
                    notes: {
                      value: e.target.value,
                      errors: [],
                    },
                  });
                }}
              />
            </div>
          </div>
          <Box display="flex" justifyContent="space-between">
            <Button onClick={closeModal} variant="outlined">
              Close
            </Button>
            <Button variant="outlined" onClick={handleSubmit}>
              Submit
            </Button>
          </Box>
        </form>
      </ThemeProvider>
    </Modal>
  );
};

export default AddTransaction;
