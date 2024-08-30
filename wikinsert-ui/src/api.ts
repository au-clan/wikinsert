/* eslint-disable import/prefer-default-export */
import config from "./config.json";
import Cookies from "js-cookie";
import { Headers, RequestInit } from "whatwg-fetch";
import { parseDate } from "./page/utils";

/**
 * Key of the API token in local storage.
 */
const tokenKey = "token";

/**
 * Customised API request init object.
 */
interface IRequestInit extends RequestInit {
  authRequired?: boolean;
  contentType?: string;
}

export enum QueryTarget {
  ARTICLE = "article",
  QUOTATION = "quotation",
  SPEAKER = "speaker",
}

export enum DateHistogramInterval {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

export interface DateRange {
  fromDate: Date;
  toDate: Date;
}

interface DateRangeResponse {
  from_date: string;
  to_date: string;
}

export interface SpeakerAttrs {
  country: Record<string, string>;
  gender: Record<string, string>;
  occupation: Record<string, string>;
}

export interface IAttrCandidates {
  country: Entity[];
  gender: Entity[];
  occupation: Entity[];
}

type SpeakerAttrsResponse = SpeakerAttrs;

export interface Entity {
  name: string;
  description?: string;
  id: string;
}

export const NIL_ENTITY: Entity = {
  id: "",
  name: "",
};

export interface Speaker extends Entity {
  aliases: string[];
  link: string;
}

export interface SpeakerResponse {
  speakers: Speaker[];
}

export interface Probas {
  speaker: string;
  proba: number;
  qids: string[];
}

export interface Article {
  id: string;
  quotations: Quotation[];
  score?: number;
  title: string;
  url: string;
  date: string;
  localProbas: Probas[];
}

export interface Quotation {
  id: string;
  speaker: string;
  score?: number;
  quotation: string;
  urls: string[];
  date: string;
  speaker_qids: string[];
  probas: Probas[];
}

export interface SearchResult {
  took: number;
  total: number;
  hitLimit: boolean;
  type: QueryTarget;
  results: Article[] | Quotation[];
  hist: DateHistogramData;
  query: SearchQuery;
}

export interface DateHistogramBucket {
  from_date: string;
  doc_count: number;
}

export interface DateHistogramData {
  buckets: DateHistogramBucket[];
  interval: DateHistogramInterval;
}

export interface SearchQuery extends Record<string, string> {
  target: QueryTarget;
  text: string;
  speaker: string;
  from_date: string;
  to_date: string;
}

export interface FullFormValues {
  target: QueryTarget;
  fromDate: Date;
  toDate: Date;
  text: string;
  speaker: Entity;
  domain: string;
  numOccurrences: string;
  speakerNationality: Entity;
  speakerGender: Entity;
  speakerOccupation: Entity;
  withContext: boolean;
  exactMatch: boolean;
}

export const NilFormValues: FullFormValues = {
  target: QueryTarget.QUOTATION,
  fromDate: new Date(),
  toDate: new Date(),
  text: "",
  speaker: { ...NIL_ENTITY },
  domain: "",
  numOccurrences: "",
  speakerNationality: { ...NIL_ENTITY },
  speakerGender: { ...NIL_ENTITY },
  speakerOccupation: { ...NIL_ENTITY },
  withContext: false,
  exactMatch: false,
};

export interface SearchArticleResponse {
  type: QueryTarget;
  took: number; // millisecond
  total: number;
  hit_limit: boolean;
  articles: Article[];
  hist: DateHistogramData;
  query: SearchQuery;
}

export interface SearchQuotationResponse {
  type: QueryTarget;
  took: number; // millisecond
  total: number;
  hit_limit: boolean;
  quotations: Quotation[];
  hist: DateHistogramData;
  query: SearchQuery;
}

/**
 * Parse response body.
 * @param res response instance.
 * @return Promise of the parsed API response.
 */
const parseResponse = (res: Response): Promise<any> => {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json();
  } else {
    return res.text();
  }
};

/**
 * Wrapper of fetch API calls. Sets the authentication tokens.
 * @param endpoint target API endpoint.
 * @param init request init.
 * @return Promise of the API response.
 */
const fetchAPI = (
  endpoint: string,
  init: IRequestInit,
  params?: Record<string, string>
): Promise<any> => {
  const token = localStorage.getItem(tokenKey);
  const headers = new Headers();

  if (init.authRequired) {
    if (!token) {
      return Promise.reject(new Error("Invalid token"));
    }

    headers.append("Authorization", token);
  }

  if (init.contentType) {
    headers.set("Content-Type", init.contentType);
  }

  const url = new URL(endpoint, config.API_SERVER);
  if (params) {
    const searchParams = new URLSearchParams(params);
    // Remove empty params
    const emptyKeys: string[] = [];
    searchParams.forEach((v, k) => {
      if (!v) {
        emptyKeys.push(k);
      }
    });
    emptyKeys.forEach((k) => searchParams.delete(k));
    url.search = searchParams.toString();
  }

  return new Promise((resolve, reject) => {
    window
      .fetch(url.toString(), {
        ...init,
        credentials: "include",
        headers,
      })
      .then((res) =>
        parseResponse(res).then((body) => {
          if (res.status < 300) {
            resolve(body);
          } else {
            reject(new Error(body.detail || JSON.stringify(body)));
          }
        })
      );
  });
};

export const getDateRange = (): Promise<DateRange> =>
  fetchAPI("/api/data/date_range", {}).then((res: DateRangeResponse) => ({
    fromDate: parseDate(res.from_date),
    toDate: parseDate(res.to_date),
  }));

export const getSpeakerAttrs = (): Promise<SpeakerAttrs> =>
  fetchAPI("/api/data/speaker_attr/", {}).then((res: SpeakerAttrsResponse) => ({
    country: res.country,
    gender: res.gender,
    occupation: res.occupation,
  }));

export const getMissingDataPeriod = (): Promise<Date[]> =>
  fetchAPI("/api/data/missing_data_period", {}).then((res: string[]) =>
    res.map((v) => new Date(v))
  );

export const getSpeaker = (speakerId: string): Promise<Speaker> =>
  fetchAPI(`/api/speaker/id/${speakerId}`, {});

export const searchSpeaker = (keyword: string): Promise<Speaker[]> =>
  fetchAPI(
    "/api/speaker/search",
    {},
    { target: QueryTarget.SPEAKER, keyword }
  ).then((res: SpeakerResponse) => res.speakers);

export const submitSearchArticleQuery = (
  query: SearchQuery
): Promise<SearchResult> =>
  fetchAPI(`/api/${QueryTarget.ARTICLE}/search`, {}, query).then(
    (res: SearchArticleResponse) => ({
      took: res.took,
      total: res.total,
      hitLimit: res.hit_limit,
      type: QueryTarget.ARTICLE,
      results: res.articles.map((article) => {
        // Remove nested quotations with duplicate IDs
        const filteredQuotations: Quotation[] = [];
        const quoteIDs: Record<string, boolean> = {};
        for (const quotation of article.quotations) {
          if (!quoteIDs[quotation.id]) {
            quoteIDs[quotation.id] = true;
            filteredQuotations.push(quotation);
          }
        }
        article.quotations = filteredQuotations;
        return article;
      }),
      hist: res.hist,
      query: res.query,
    })
  );

export const submitSearchQuotationQuery = (
  query: SearchQuery
): Promise<SearchResult> =>
  fetchAPI(`/api/${QueryTarget.QUOTATION}/search`, {}, query).then(
    (res: SearchQuotationResponse) => ({
      took: res.took,
      total: res.total,
      hitLimit: res.hit_limit,
      type: QueryTarget.QUOTATION,
      results: res.quotations,
      hist: res.hist,
      query: res.query,
    })
  );

export const getSampleSearchQuotationQuery = (): Promise<SearchResult> =>
  fetchAPI(`/api/${QueryTarget.QUOTATION}/search/sample`, {}).then(
    (res: SearchQuotationResponse) => ({
      took: res.took,
      total: res.total,
      hitLimit: res.hit_limit,
      type: QueryTarget.QUOTATION,
      results: res.quotations,
      hist: res.hist,
      query: res.query,
    })
  );
