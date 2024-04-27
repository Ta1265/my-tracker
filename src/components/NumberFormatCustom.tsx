import { NumericFormat } from 'react-number-format';

export default function NumberFormatCustom(props) {
  const { inputRef, onChange, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={inputRef}
      thousandsSeparator={true}
      isNumericString
      decimalScale={10}
      onValueChange={(values: any) => {
        onChange({
          target: {
            value: values.floatValue,
          },
        });
      }}
    />
  );
}