import React, { FC } from "react";
import { FieldProps } from "formik";
import DatePicker from "react-datepicker";
import classNames from "classnames";

import "react-datepicker/dist/react-datepicker.css";
const styles = require("./field.scss");

interface DateFieldProps {
  label: string;
  maxDate?: Date;
  minDate?: Date;
  disabled?: boolean;
  compact?: boolean;
  onChange?: (d: Date) => void;
}

const DateField: FC<FieldProps & DateFieldProps> = ({
  field,
  form: { setFieldValue, errors, touched },
  label,
  disabled,
  compact,
  onChange,
  ...props
}) => {
  return (
    <div
      className={
        compact
          ? classNames(styles.fieldWrapper, styles.compact)
          : styles.fieldWrapper
      }
    >
      <div className={'row'}>
        <div className={classNames('col-12 col-md-2', 'my-auto')}>{label}</div>
        <div className={classNames('col-12 col-md-10', 'my-auto')} data-cy={`date-${label}`}>
          <DatePicker
            className={'w-100'}
            wrapperClassName="d-block w-100"
            disabled={disabled}
            selected={field.value}
            onChange={(date: Date) => {
              setFieldValue(field.name, date);
              onChange && onChange(date);
            }}
            placeholderText="Select a date"
            {...props}
          />
          {(errors[field.name] && touched[field.name] && (
            <div className={classNames(styles.fieldError, styles.dateError)}>
              {errors[field.name]}
            </div>
          )) || <div className={styles.dateError}>&nbsp;</div>}
        </div>
      </div>
    </div>
  );
};

export default DateField;
