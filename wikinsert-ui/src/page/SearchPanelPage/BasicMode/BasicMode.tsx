import React from "react";
import { DateRange, getSampleSearchQuotationQuery } from "src/api";
import {
  setResult,
  ISearchAppState,
  setSearchQuery,
} from "src/reducer/resultReducer";
import { RouteComponentProps } from "react-router-dom";
import { connect, ConnectedProps } from "react-redux";
import classNames from "classnames";
import { batchActions } from "redux-batched-actions";
import SearchBar from "src/page/ResultPage/Header/SearchBar";
import LoadingAnimation from "../LoadingAnimation";

const styles = require("./basicmode.scss");
const pageStyles = require("../searchpanel.scss");
const connector = connect((state: ISearchAppState) => ({
  dateRange: state.dateRange,
  misc: state.speakerAttrs,
  searchQuery: state.searchQuery,
}));
interface IBasicModeProps extends ConnectedProps<typeof connector> {
  dateRange: DateRange | undefined;
  history: RouteComponentProps["history"];
  location: RouteComponentProps["location"];
  changeModeHandler: () => void;
  onSubmit: () => void;
}

const BasicMode = (props: IBasicModeProps): JSX.Element => {
  const [submitted, setSubmitted] = React.useState(false);
  const [searchedText, setSearchText] = React.useState("");
  const textBtnStyle = submitted
    ? classNames(pageStyles.disabled, pageStyles.textBtn)
    : pageStyles.textBtn;
  return (
    <>
      <div className={classNames(styles.inputWrapper, 'mt-2', 'mt-md-5')}>
        <div className={styles.input}>
          <div>
            <SearchBar
              history={props.history}
              location={props.location}
              isCenterted={true}
              nextPathName="/search"
              placeholder="Keywords of quotations..."
              preSubmit={(text?:string) => {setSubmitted(true); if (text) setSearchText(text); } }
            />
            <div className={styles.textButtons}>
              <div
                className={textBtnStyle}
                title="Try an example search query"
                data-cy="feeling-lucky"
                onClick={() =>
                  getSampleSearchQuotationQuery().then((res) => {
                    props.dispatch(
                      batchActions([
                        setSearchQuery(
                          res.query,
                          new URLSearchParams(res.query)
                        ),
                        setResult(res),
                      ])
                    );
                    props.onSubmit();
                  })
                }
              >
                I&apos;m feeling lucky
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={submitted ? styles.loadingAnimationBox : classNames(styles.loadingAnimationBox, 'invisible')}>
        <LoadingAnimation tick={3000} slides={[
          "Digging through 480GB of data...",
          searchedText ? "Finding quotes about \"" + searchedText + "\"..." : "Finding quotes that match your requirements...",
          "Looking for the answer to the ultimate question of life...",
          "Analyzing more than 178 million quotes..."
        ]} />
      </div>
    </>
  );
};

export default connector(BasicMode);
