import React, { FC } from "react";
import { FieldProps } from "formik";
import { QueryTarget } from "src/api";
import classNames from "classnames";

const styles = require("./field.scss");

const TargetField: FC<
  FieldProps & { disabled?: boolean; compact?: boolean }
> = ({ field, form: { setFieldValue }, disabled, compact }) => {
  const selectedClassName = disabled
    ? classNames(styles.targetButton, styles.selected, styles.disabled)
    : classNames(styles.targetButton, styles.selected);
  const nonSelectedClassName = disabled
    ? classNames(styles.disabled, styles.targetButton)
    : styles.targetButton;
  return (
    <div
      className={
        compact
          ? classNames(styles.fieldWrapper, styles.compact)
          : styles.fieldWrapper
      }
    >
      <div className={classNames('row')}>
        <div className={classNames('col-12 col-md-6', 'my-auto')}>Select data set to search:&nbsp;</div>
        <div
          className={classNames(styles.targetToggle, 'col-12 col-md-6', 'my-auto')}
          data-cy="field-target"
        >
          <div
            className={
              field.value === QueryTarget.QUOTATION
                ? selectedClassName
                : nonSelectedClassName
            }
            onClick={() =>
              !disabled && setFieldValue(field.name, QueryTarget.QUOTATION)
            }
          >
            Quotation-centric
          </div>
          <div
            className={
              field.value === QueryTarget.ARTICLE
                ? selectedClassName
                : nonSelectedClassName
            }
            onClick={() =>
              !disabled && setFieldValue(field.name, QueryTarget.ARTICLE)
            }
          >
            Article-centric
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetField;
