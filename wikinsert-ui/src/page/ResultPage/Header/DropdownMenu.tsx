import React from "react";
import { Field, FieldProps } from "formik";
import { IAttrCandidates, QueryTarget, searchSpeaker, Speaker } from "src/api";
import TargetField from "src/ui/Field/TargetField";
import CheckboxField from "src/ui/Field/CheckboxField";
import AutoCompleteField from "src/ui/Field/AutoCompleteField";
import DateField from "src/ui/Field/DateField";
import TextField from "src/ui/Field/TextField";
import classNames from "classnames";

const styles = require("./searchbar.scss");

const DropdownMenu = (props: {
  attrCandidates?: IAttrCandidates;
  isCentered?: boolean;
  getSpeakerAttrs: () => void;
}): JSX.Element => {
  const { attrCandidates, isCentered, getSpeakerAttrs } = props;
  React.useEffect(() => {
    if (!attrCandidates) {
      getSpeakerAttrs();
    }
  }, [attrCandidates]);

  return (
    <div className={isCentered ? classNames(styles.dropdown, styles.centerDropdown) : classNames(styles.dropdown, styles.sideDropdown)} data-cy="dropdown">
      <div className={'container-fluid'}>
      <Field
        name="target"
        component={(props: FieldProps) => <TargetField compact {...props} />}
      />
      <Field
        name="exactMatch"
        component={(props: FieldProps) => (
          <CheckboxField
            label="Enable exact match"
            tooltip="Must match the entire query text"
            compact
            {...props}
          />
        )}
      />
      <Field
        name="withContext"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.ARTICLE && (
            <CheckboxField
              label="Search with context"
              tooltip="Also search in the textual context of quotations"
              compact
              {...props}
            />
          )) ||
          null
        }
      />
      <Field
        name="speaker"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.QUOTATION && (
            <AutoCompleteField
              compact
              label="Name of speaker"
              tooltip="Filter results by the name of the speaker of a quotation"
              searchHandler={(q: string) =>
                searchSpeaker(q).then((results: Speaker[]) =>
                  results.map((speaker) => {
                    let description = speaker.description;
                    if (!description) {
                      if (speaker.aliases.length > 0) {
                        description = `Also known as: ${speaker.aliases.join(
                          ","
                        )}`;
                      }
                    }
                    return {
                      description,
                      id: speaker.id,
                      name: speaker.name,
                    };
                  })
                )
              }
              {...props}
            />
          )) ||
          null
        }
      />
      <Field
        name="speakerNationality"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.QUOTATION && (
            <AutoCompleteField
              compact
              label="Nationality of speaker"
              placeholder="Search for a country"
              tooltip='Filter results by the nationality of the speaker of a quotation, e.g., "Switzerland"'
              searchHandler={(q: string) => {
                if (!attrCandidates) {
                  return Promise.resolve([]);
                }
                const lowerQ = q.toLowerCase();
                return Promise.resolve(
                  attrCandidates.country.filter((attr) =>
                    attr.name.toLowerCase().startsWith(lowerQ)
                  )
                );
              }}
              {...props}
            />
          )) ||
          null
        }
      />
      <Field
        name="speakerGender"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.QUOTATION && (
            <AutoCompleteField
              compact
              label="Gender of speaker"
              placeholder="Search for a type of gender"
              tooltip='Filter results by the gender of the speaker of a quotation, e.g., "female"'
              searchHandler={(q: string) => {
                if (!attrCandidates) {
                  return Promise.resolve([]);
                }
                const lowerQ = q.toLowerCase();
                return Promise.resolve(
                  attrCandidates.gender.filter((attr) =>
                    attr.name.toLowerCase().startsWith(lowerQ)
                  )
                );
              }}
              {...props}
            />
          )) ||
          null
        }
      />
      <Field
        name="speakerOccupation"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.QUOTATION && (
            <AutoCompleteField
              compact
              label="Occupation of speaker"
              placeholder="Search for an occupation"
              tooltip='Filter results by the occupation of the speaker of a quotation, e.g., "politician"'
              searchHandler={(q: string) => {
                if (!attrCandidates) {
                  return Promise.resolve([]);
                }
                const lowerQ = q.toLowerCase();
                return Promise.resolve(
                  attrCandidates.occupation.filter((attr) =>
                    attr.name.toLowerCase().startsWith(lowerQ)
                  )
                );
              }}
              {...props}
            />
          )) ||
          null
        }
      />
      <Field
        name="domain"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.QUOTATION && (
            <TextField
              compact
              label="URL domain"
              tooltip='Filter results by the URL domain of the source of a quotation, e.g., "nytimes.com"'
              placeholder="Input a URL domain"
              {...props}
            />
          )) ||
          null
        }
      />
      <Field
        name="numOccurrences"
        component={(props: FieldProps) =>
          (props.form.values.target === QueryTarget.QUOTATION && (
            <TextField
              compact
              label="Minimum number of occurrences"
              tooltip="Retrieve quotations that occurred more times than this threshold"
              placeholder="Input a number"
              {...props}
            />
          )) ||
          null
        }
      />
      <div className={'row'}>
        <div className={classNames('col-6')}>
          <Field
            name="fromDate"
            component={(props: FieldProps) => (
              <DateField
                compact
                label="From"
                maxDate={props.form.values.toDate}
                {...props}
              />
            )}
          />
        </div>
        <div className={classNames('col-6')}>
          <Field
            name="toDate"
            component={(props: FieldProps) => (
              <DateField
                compact
                label="To"
                minDate={props.form.values.fromDate}
                {...props}
              />
            )}
          />
        </div>
      </div>
      </div>
    </div>
  );
};

export default DropdownMenu;
