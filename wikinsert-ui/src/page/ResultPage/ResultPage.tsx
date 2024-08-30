import React from "react";
import {
  Article,
  Quotation,
  getMissingDataPeriod,
  submitSearchArticleQuery,
  submitSearchQuotationQuery,
  QueryTarget,
  SearchResult,
  getDateRange,
  getSpeakerAttrs,
} from "src/api";
import { RouteComponentProps } from "react-router-dom";
import Histogram from "./Histogram";
import Header from "./Header";
import ResultContainer from "./ResultContainer";
import classNames from "classnames";
import { connect, ConnectedProps } from "react-redux";
import {
  ISearchAppState,
  setMissingDataPeriod,
  setSearchQuery,
  setResult,
  setLoading,
  setDateRange,
  setSearchOptions,
} from "src/reducer/resultReducer";
import {
  parseQueryParams,
  composePermalink,
  convertValueToQuery,
} from "src/page/utils";
import Button from "src/ui/Button";
import Footer from "src/ui/Footer";
import DropdownIcon from "src/ui/icons/expand_more_black_24dp.svg";
import yaml from "js-yaml";
import { batchActions } from "redux-batched-actions";
import Loader from "src/ui/Loader";
import { Col, Container, Row } from "react-bootstrap";

const styles = require("./resultpage.scss");
const connector = connect((state: ISearchAppState) => ({
  data: state.result,
  searchQuery: state.searchQuery,
  searchParams: state.searchParams,
  missingDataPeriod: state.missingDataPeriod,
  loading: state.loading,
  dateRange: state.dateRange,
  misc: state.speakerAttrs,
}));

type IResultPageProps = ConnectedProps<typeof connector>;

const ResultPage = (
  props: IResultPageProps & RouteComponentProps
): JSX.Element => {
  React.useEffect(() => {
    let promise = Promise.resolve();
    if (!props.dateRange || !props.misc) {
      promise = Promise.all([getDateRange(), getSpeakerAttrs()]).then(
        ([dateRange, attrs]) => {
          props.dispatch(
            batchActions([setDateRange(dateRange), setSearchOptions(attrs)])
          );
        }
      );
    }
    promise.then(() => {
      const { values, ok } = parseQueryParams(props.location.search);
      const query = convertValueToQuery(values);
      if (!props.searchQuery) {
        props.dispatch(setSearchQuery(query, composePermalink(values)));
      }

      if (!props.data) {
        // If there is anything valid in the query param, submit query and display
        if (ok.reduce((acc, curr) => acc || curr, false)) {
          const call =
            values.target === QueryTarget.ARTICLE
              ? submitSearchArticleQuery
              : submitSearchQuotationQuery;
          call(query)
            .then((res: SearchResult) => {
              props.dispatch(setResult(res));
              return getMissingDataPeriod();
            })
            .then((res) => {
              props.dispatch(
                batchActions([setMissingDataPeriod(res), setLoading(false)])
              );
            })
            .catch(() => props.history.replace("/"));
        } else {
          props.history.replace("/");
        }
      }
    });
  }, [props.data]);
  const timeSpentStyle = props.data?.total
    ? styles.timeSpent
    : classNames(styles.timeSpent, styles.hidden);
  const summaryMessage =
    (props.data && props.data.total > 0 && (
      <>
        {`Found ${(props.data.hitLimit && "more than ") || ""} ${
          props.data.total
        } `}
        <u>{`${props.data.type}${(props.data.total !== 1 && "s") || ""}`}</u>
        {` in ${props.data.took / 1000 || 0} second${
          (props.data.took !== 1000 && "s") || ""
        }. ${
          (props.data.hitLimit &&
            `Only the first ${props.data.total} results are displayed.`) ||
          ""
        }`}
      </>
    )) ||
    "";
  return (
    <>
      <Header history={props.history} location={props.location} />
      <Container className={styles.wrapper}>
        <div
          className={
            props.loading
              ? classNames(styles.fadeOut)
              : classNames(styles.fadeIn)
          }
        >
          <Row className={timeSpentStyle}>
            <Col md={8} className={classNames('text-left', 'order-last', 'order-md-first')} data-cy="summary">
              {summaryMessage}
            </Col>
            {props.data && props.data.total > 0 && (
              <Col md={4} className={classNames(styles.buttons, 'd-flex', 'justify-content-center', 'justify-content-md-end', 'mb-2', 'mb-md-0', 'align-items-center')}>
                <CopyButton params={props.searchParams} />
                <DownloadMenu data={props.data.results} />
              </Col>
            )}
            {(props.searchQuery &&
            props.data &&
            props.data.results.length > 0 && (
              <div className={classNames('d-none', 'd-sm-block')}>
                <Histogram
                  hist={props.data.hist}
                  width={800}
                  type={props.searchQuery.target}
                  queryFromDate={props.searchQuery.from_date}
                  queryToDate={props.searchQuery.to_date}
                  missingDataPeriod={props.missingDataPeriod || []}
                />
              </div>
            )) ||
            null}
          </Row>
          
          <ResultContainer
            type={props.data?.type}
            query={props.searchParams?.toString()}
            data={props.data?.results || []}
            setSortedData={(sortedResults: Article[] | Quotation[]) =>
              props.data &&
              props.dispatch(
                setResult({ ...props.data, results: sortedResults })
              )
            }
          />
        </div>
        <div className={props.loading ? "" : styles.fadeOut}>
          <Loader />
        </div>
      </Container>
      <Footer abs={!props.data || props.data.results.length === 0} />
    </>
  );
};

const CopyButton = (props: { params?: URLSearchParams }): JSX.Element => {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <Button
      data-cy="copy-button"
      className={styles.toolButton}
      onClick={() => {
        const permalink = new URL(location.origin);
        if (props.params) {
          permalink.pathname = location.pathname;
          permalink.search = props.params.toString();
        }
        navigator.clipboard.writeText(permalink.toString()).then(() => {
          if (ref.current) {
            ref.current.setAttribute("data-tooltip", "Copied!");
            setTimeout(() => {
              if (ref.current) {
                ref.current.setAttribute("data-tooltip", "Copy link");
              }
            }, 2000);
          }
        });
      }}
    >
      <div className={styles.inner} ref={ref} data-tooltip="Copy link">
        Share
      </div>
    </Button>
  );
};

const DownloadMenu = (props: {
  data: Article[] | Quotation[];
}): JSX.Element => {
  const [dropdownVisible, setDropdownVisible] = React.useState(false);
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    // Hide the dropdown list if clicked on outside of the list
    const handleClickOutside = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setDropdownVisible(false);
      }
    };

    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [buttonRef, dropdownRef]);

  return (
    <div className={classNames(styles.toolButton, styles.menuButton)}>
      <div
        className={styles.inner}
        ref={buttonRef}
        data-cy="download-menu"
        onClick={() => setDropdownVisible(!dropdownVisible)}
      >
        Save results
        <DropdownIcon
          height="16px"
          width="16px"
          fill="#333"
          viewBox="0 0 24 24"
        />
      </div>
      {dropdownVisible && (
        <div className={styles.menu} ref={dropdownRef}>
          <div
            className={styles.menuOption}
            data-cy="download-json"
            onClick={() =>
              createDownloadElement(
                JSON.stringify(props.data, null, 2),
                "quotebank.json"
              )
            }
          >
            as JSON
          </div>
          <div
            className={styles.menuOption}
            data-cy="download-yaml"
            onClick={() =>
              createDownloadElement(
                yaml.dump(props.data, {
                  lineWidth: -1,
                  noRefs: true,
                }),
                "quotebank.txt"
              )
            }
          >
            as pure text
          </div>
        </div>
      )}
    </div>
  );
};

const createDownloadElement = (data: string, filename: string) => {
  const content = document.createElement("a");
  content.setAttribute("data-cy", "download");
  content.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(data)
  );
  content.setAttribute("download", filename);
  content.style.display = "none";

  document.body.appendChild(content);
  content.click();
  document.body.removeChild(content);
};

export default connector(ResultPage);
