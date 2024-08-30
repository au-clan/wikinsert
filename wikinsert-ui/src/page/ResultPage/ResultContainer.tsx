import React from "react";
import { Quotation, Article, QueryTarget } from "src/api";
import classNames from "classnames";
import InfoIcon from "src/ui/icons/info_black_18dp.svg";
import MoreIcon from "src/ui/icons/more_horiz_black_18dp.svg";
import QuoteIcon from "src/ui/icons/format_quote_black_48dp.svg";
import ClearIcon from "src/ui/icons/clear_black_24dp.svg";

import { parseDate } from "../utils";
import { Button, Modal } from "react-bootstrap";

const styles = require("./resultpage.scss");
const commonStyles = require("src/ui/common.scss");

const COLLAPSED_MAX_HEIGHT = 2; // Collapse only if there are too many items
const WIKIDATA_URI_PREFIX = "https://www.wikidata.org/wiki/";

const Row: (props: {
  label: string;
  value: React.ReactNode;
  height: number;
  collapsible?: boolean;
}) => JSX.Element = ({ label, value, height, collapsible }) => (
  <div className={classNames(styles.row, 'row')}>
    <div className={classNames(styles.label, styles.result, 'col-12', 'col-md-2')}>
      <span className="d-md-none h5"><b>{label}</b></span>
      <span className="d-none d-md-inline">{label}</span>
    </div>
    {collapsible ? (
      <Collapsible value={value} height={height} />
    ) : (
      <div className={classNames(styles.value, styles.result, 'col-12', 'col-md-10')}>{value}</div>
    )}
  </div>
);

const Collapsible: (props: {
  value: React.ReactNode;
  height: number;
}) => JSX.Element = ({ value, height }) => {
  const [collapsed, SetCollapsed] = React.useState(true);
  const buttonText = collapsed ? "Show more" : "Show less";
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <div className={classNames(styles.value, styles.result)}>
      <div
        ref={ref}
        className={
          height > COLLAPSED_MAX_HEIGHT
            ? collapsed
              ? classNames(styles.collapsible, styles.collapsed)
              : classNames(styles.collapsible, styles.notCollapsed)
            : styles.collapsible
        }
      >
        {value}
      </div>
      {(height > COLLAPSED_MAX_HEIGHT && (
        <>
          {!collapsed && <div className={styles.placeholder}>&nbps;</div>}
          <div className={styles.collapseBar}>
            <div
              className={
                collapsed
                  ? classNames(styles.bar, styles.collapsed)
                  : styles.bar
              }
              onClick={() => SetCollapsed(!collapsed)}
            >
              {buttonText}
            </div>
          </div>
        </>
      )) ||
        null}
    </div>
  );
};

const SpeakerList = (props: { quotation: Quotation; compact?: boolean }) => {
  const [show, setShow] = React.useState(false);
  const [content, setContent] = React.useState(Array<JSX.Element>());

  const handleClose = () => setShow(false);
  const showModal = (content : Array<JSX.Element>) => {
    setContent(content);
    setShow(true);
  };

  return (<>
  <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>All candidates</Modal.Title>
      </Modal.Header>
      <Modal.Body>{content}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>

  <Row
    label="Possible speakers"
    collapsible={true}
    height={props.quotation.probas.length}
    value={
      <div className={classNames(styles.attrBlock)}>
        {props.quotation.probas.map((proba, idx) => (
          <>
            {idx !== 0 && <hr />}
            <div
              className={styles.speakerBlock}
              key={`${props.quotation.id}-${proba.speaker}`}
            >
              <div
                className={
                  props.compact
                    ? classNames(styles.name, styles.compact)
                    : styles.name
                }
              >
                {proba.qids.length > 0 ? proba.speaker : "Unknown speaker"}
                {proba.qids.length > 0 && 
                (<a
                  href={WIKIDATA_URI_PREFIX + proba.qids[0]}
                  target="_blank"
                  rel="noreferrer"
                  className={classNames('d-md-none', 'd-inline')}
                >
                  &nbsp;<i>({proba.qids[0]})</i>
                </a>)}
                {proba.qids.length > 1 &&
                <div className={classNames('d-inline', 'd-md-none')}>
                &nbsp;<span onClick={() => {showModal(
                  proba.qids.map((qid, qidIdx) => (
                    <>
                      <a
                        href={WIKIDATA_URI_PREFIX + qid}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {qid}
                      </a>
                      {qidIdx !== proba.qids.length - 1 && ", "}
                    </>
                  ))
                )}} className={styles.cursor_pointer}>&nbsp;<i><MoreIcon style={{ verticalAlign: "top" }} /> More</i></span>
              </div>
                }
              </div>
              <div className={classNames(styles.qids, 'd-none', 'd-md-block')}>
                {proba.qids.map((qid, qidIdx) => (
                  <>
                    <a
                      href={WIKIDATA_URI_PREFIX + qid}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {qid}
                    </a>
                    {qidIdx !== proba.qids.length - 1 && ", "}
                  </>
                ))}
              </div>

              <div className={styles.proba}>
                {(proba.proba * 100).toFixed(2)}%
              </div>
            </div>
          </>
        ))}
      </div>
    }
  />
</>)
};

const ArticleBlock = (props: { article: Article }) => (
  <div className={styles.resultBlock} data-cy="article">
    <div className={styles.title}>
      <a href={props.article.url} target="_blank" rel="noreferrer">
        {props.article.title}
      </a>
    </div>
    <div className={styles.meta}>
      <div className={styles.date}>
        {parseDate(props.article.date).toUTCString()}
      </div>
      <div>
        <a href={props.article.url} target="_blank" rel="noreferrer">
          [Article source]
        </a>
      </div>
    </div>
    <hr />
    <Row
      label="Quotations"
      collapsible={true}
      height={props.article.quotations.length}
      value={props.article.quotations.map((quotation) => (
        <NestedQuotationBlock
          key={`a-${props.article.id}-q-${quotation.id}`}
          quotation={quotation}
        />
      ))}
    />
  </div>
);

const NestedQuotationBlock = (props: { quotation: Quotation }) => (
  <div
    className={classNames(styles.resultBlock, styles.quotation)}
    data-cy="quotation"
  >
    <div>{props.quotation.quotation}</div>
    <hr />
    <SpeakerList quotation={props.quotation} compact />
  </div>
);

const QuotationBlock = (props: { quotation: Quotation }) => (
  <div
    className={classNames(styles.resultBlock, styles.quotation, 'mt-4', 'mt-md-3')}
    data-cy="quotation"
  >
    <div className={styles.title}>{props.quotation.quotation}</div>
    <div className={styles.meta}>
      <div className={styles.date}>
        {parseDate(props.quotation.date).toUTCString()}
      </div>
    </div>
    <hr />
    <SpeakerList quotation={props.quotation} />
    <Row
      label="Source"
      collapsible={true}
      height={props.quotation.urls.length}
      value={
        <div className={styles.attrBlock}>
          {props.quotation.urls.map((url, idx) => (
            <>
              {idx !== 0 && <hr />}
              <div key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </div>
            </>
          ))}
        </div>
      }
    />
  </div>
);

const getBlocks = (
  data: Article[] | Quotation[],
  cursor: number,
  type?: QueryTarget
): JSX.Element[] | null => {
  if (data.length === 0) {
    return [
      <div className={styles.notFound} key="notfound">
         <QuoteIcon /> No results found matching your query
         <div className={classNames('h3', 'text-secondary')}>Consider changing your search parameters</div>
      </div>,
    ];
  }

  switch (type) {
    case QueryTarget.ARTICLE:
      return (data.slice(
        cursor,
        cursor + 10
      ) as Article[]).map((item: Article) => (
        <ArticleBlock key={`a-${item.id}`} article={item} />
      ));
    case QueryTarget.QUOTATION:
      return (data.slice(
        cursor,
        cursor + 10
      ) as Quotation[]).map((item: Quotation) => (
        <QuotationBlock key={`q-${item.id}`} quotation={item} />
      ));
    default:
      return null;
  }
};

const NavBar = (props: {
  dataSize: number;
  cursor: number;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
}): JSX.Element => (
  <div className={styles.navbar}>
    {props.cursor - 10 >= 0 && props.cursor < props.dataSize && (
      <div
        data-cy="prev"
        onClick={() => props.setCursor(props.cursor - 10)}
        className={styles.button}
      >
        « Prev
      </div>
    )}
    {props.cursor >= 0 && props.cursor + 10 < props.dataSize && (
      <div
        data-cy="next"
        onClick={() => props.setCursor(props.cursor + 10)}
        className={classNames(styles.right, styles.button)}
      >
        Next »
      </div>
    )}
  </div>
);

const ArticleSortingKey: Record<string, string> = {
  SCORE_DESC: "Content matching score (descending)",
  SCORE_ASC: "Content matching score (ascending)",
  DATE_DESC: "Date (descending)",
  DATE_ASC: "Date (ascending)",
};

const QuotationSortingKey = {
  ...ArticleSortingKey,
  SPEAKER_DESC: "Speaker name (descending)",
  SPEAKER_ASC: "Speaker name (ascending)",
};

const SortMenu = (props: {
  query?: string;
  options: Record<string, string>;
  sortHandler: (v: string) => void;
}) => {
  // query is only used to reset the select to the default option.
  React.useEffect(() => setSelected(ArticleSortingKey.SCORE_DESC), [
    props.query,
  ]);
  const [selected, setSelected] = React.useState(ArticleSortingKey.SCORE_DESC);
  return (
    <div className={styles.sortMenu}>
      <label>Sort by</label>
      <select
        data-cy="sort-select"
        onChange={(e) => {
          props.sortHandler(e.target.value);
          setSelected(e.target.value);
        }}
        value={selected}
      >
        {Object.entries(props.options).map(([key, value]) => (
          <option value={value} key={key}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
};

const sortResults = (
  key: string,
  data: Article[] | Quotation[]
): Article[] | Quotation[] => {
  if (
    key === ArticleSortingKey.SCORE_ASC ||
    key === ArticleSortingKey.SCORE_DESC
  ) {
    const sign = key === ArticleSortingKey.SCORE_ASC ? 1 : -1;
    return data.sort((a: Quotation | Article, b: Quotation | Article) => {
      if (a.score === undefined && b.score === undefined) {
        return 0;
      }
      if (
        a.score === undefined ||
        (b.score !== undefined && a.score < b.score)
      ) {
        return -1 * sign;
      }
      if (b.score === undefined || a.score > b.score) {
        return 1 * sign;
      }
      return 0;
    });
  } else if (
    key === ArticleSortingKey.DATE_ASC ||
    key === ArticleSortingKey.DATE_DESC
  ) {
    const sign = key === ArticleSortingKey.DATE_ASC ? 1 : -1;
    return data.sort((a: Quotation | Article, b: Quotation | Article) => {
      if (a.date > b.date) {
        return 1 * sign;
      }
      if (a.date < b.date) {
        return -1 * sign;
      }
      return 0;
    });
  } else {
    const sign = key === QuotationSortingKey.SPEAKER_ASC ? 1 : -1;
    return data.sort((a: Quotation | Article, b: Quotation | Article) => {
      if ("speaker" in a && "speaker" in b) {
        if (a.speaker > b.speaker) {
          return 1 * sign;
        }
        if (a.speaker < b.speaker) {
          return -1 * sign;
        }
      }
      return 0;
    });
  }
};

const ResultContainer = (props: {
  type?: QueryTarget;
  query?: string;
  data: Article[] | Quotation[];
  setSortedData: (v: Article[] | Quotation[]) => void;
}): JSX.Element | null => {
  const [cursor, setCursor] = React.useState(0);
  return (
    (props.type && (
      <>
        {props.data.length > 0 && (
          <div className={styles.disclaimer}>
            <InfoIcon fill="#333" />
            <span>
              The speakers are attributed by our machine learning model, which
              uses the textual context. As with all machine learning models,
              some attributions may be erroneous. For details, please refer to{" "}
              <a
                href="https://dl.acm.org/doi/10.1145/3437963.3441760"
                target="_blank"
                rel="noreferrer"
                className={commonStyles.underline}
              >
                our paper
              </a>
              .
            </span>
          </div>
        )}
        <NavBar
          dataSize={props.data.length}
          cursor={cursor}
          setCursor={setCursor}
        />
        {props.data.length > 0 && (
          <SortMenu
            query={props.query}
            options={
              props.type === QueryTarget.QUOTATION
                ? { ...QuotationSortingKey }
                : { ...ArticleSortingKey }
            }
            sortHandler={(key: string) =>
              props.setSortedData(sortResults(key, props.data))
            }
          />
        )}
        <div className={styles.resultContainer}>
          {getBlocks(props.data, cursor, props.type)}
        </div>
        <NavBar
          dataSize={props.data.length}
          cursor={cursor}
          setCursor={setCursor}
        />
      </>
    )) ||
    null
  );
};

export default ResultContainer;
