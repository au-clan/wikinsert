const count = 11;
import query from "./query";

export const SPEAKER_RESPONSE = query.speaker;

export const QUOTATION_RESPONSE = {
  took: 1000,
  total: count,
  hit_limit: false,
  type: "quotation",
  quotations: [...Array(count - 1).keys()]
    .map((i) => ({
      id: `id-${i}`,
      speaker: "A",
      quotation: `quotation-${i}`,
      urls: ["http://URL-A", "http://URL-B"],
      date: "2010-01-01 01:02:03",
      speaker_qids: [{ A: "Q1" }],
      probas: [{ qids: ["A"], speaker: "A", proba: 0.1 }],
    }))
    .concat({
      id: `id-${count - 1}`,
      speaker: "B",
      quotation: `quotation-${count - 1}`,
      urls: ["http://URL-A", "http://URL-B"],
      date: "2010-01-01 01:02:03",
      speaker_qids: [{ A: "Q1" }],
      probas: [{ qids: ["A"], speaker: "A", proba: 0.1 }],
    }),
  hist: {
    buckets: [{ from_date: "2010-01-01", doc_count: count }],
    interval: "day",
  },
};

export const SAMPLE_QUOTAION_RESPONSE = {
  took: 1000,
  total: count,
  hit_limit: false,
  type: "quotation",
  quotations: [...Array(count).keys()].map((i) => ({
    id: `id-${i}`,
    speaker: "A",
    quotation: `quotation-${i}`,
    urls: ["http://URL-A", "http://URL-B"],
    date: "2010-01-01 01:02:03",
    speaker_qids: [{ A: "Q1" }],
    probas: [{ qids: ["A"], speaker: "A", proba: 0.1 }],
  })),
  hist: {
    buckets: [{ from_date: "2010-01-01", doc_count: count }],
    interval: "day",
  },
  query: {
    target: "quotation",
    text: query.text,
    speaker: query.speaker.id,
    from_date: query.fromDate,
    to_date: query.toDate,
  },
};

export const ARTICLE_RESPONSE = {
  took: 1000,
  total: count,
  hit_limit: false,
  type: "article",
  articles: [...Array(count).keys()].map((i) => ({
    id: `id-${i}`,
    quotations: [
      {
        id: `id-${i}`,
        speaker: "A",
        quotation: `quotation-${i}`,
        urls: ["http://URL-A", "http://URL-B"],
        date: "2010-01-01 01:02:03",
        speaker_qids: [{ A: "Q1" }],
        probas: [{ qids: ["A"], speaker: "A", proba: 0.1 }],
      },
    ],
    title: `article-${i}`,
    url: "http://URL",
    date: "2010-01-01 01:02:03",
    names: [{ name: "A", qids: ["Q1"] }],
  })),
  hist: {
    buckets: [{ from_date: "2010-01-01", doc_count: count }],
    interval: "day",
  },
};
