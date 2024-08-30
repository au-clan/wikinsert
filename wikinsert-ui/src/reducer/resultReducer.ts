import { createStore, Store, AnyAction } from "redux";
import { DateRange, SearchQuery, SearchResult, SpeakerAttrs } from "src/api";
import { enableBatching } from "redux-batched-actions";

const CACHE_SIZE = 20;
export interface ISearchAppState {
  result?: SearchResult;
  speakerAttrs?: SpeakerAttrs;
  dateRange?: DateRange;
  searchQuery?: SearchQuery;
  searchParams?: URLSearchParams;
  missingDataPeriod?: Date[];
  loading: boolean;
  speakerCache: Map<string, string>;
}

const SET_RESULT = "SET_RESULT";
const SET_SEARCH_OPTIONS = "SET_SEARCH_OPTIONS";
const SET_LOADING = "SET_LOADING";
const SET_DATE_RANGE = "SET_DATE_RANGE";
const SET_SEARCH_QUERY = "SET_SEARCH_QUERY";
const SET_MISSING_DATA_DATE = "SET_MISSING_DATA_DATE";
const SET_SPEAKER = "SET_SPEAKER";
const GET_SPEAKER = "GET_SPEAKER";

interface SetResultAction {
  type: typeof SET_RESULT;
  payload: SearchResult;
}

interface SetLoadingAction {
  type: typeof SET_LOADING;
  payload: boolean;
}

interface SetSearchOptionsAction {
  type: typeof SET_SEARCH_OPTIONS;
  payload: SpeakerAttrs;
}

interface SetDateRangeAction {
  type: typeof SET_DATE_RANGE;
  payload: DateRange;
}

interface SetMissingDataPeriodAction {
  type: typeof SET_MISSING_DATA_DATE;
  payload: Date[];
}

interface SetSearchQueryAction {
  type: typeof SET_SEARCH_QUERY;
  payload: {
    query: SearchQuery;
    params: URLSearchParams;
  };
}

interface SetSpeakerAction {
  type: typeof SET_SPEAKER;
  payload: { name: string; id: string };
}

interface GetSpeakerAction {
  type: typeof GET_SPEAKER;
  payload: string;
}

export type ActionType =
  | SetResultAction
  | SetSearchOptionsAction
  | SetLoadingAction
  | SetDateRangeAction
  | SetSearchQueryAction
  | SetMissingDataPeriodAction
  | SetSpeakerAction
  | GetSpeakerAction
  | AnyAction;

export const setResult = (v: SearchResult): ActionType => ({
  type: SET_RESULT,
  payload: v,
});

export const setLoading = (v: boolean): ActionType => ({
  type: SET_LOADING,
  payload: v,
});

export const setSearchOptions = (v: SpeakerAttrs): ActionType => ({
  type: SET_SEARCH_OPTIONS,
  payload: v,
});

export const setDateRange = (v: DateRange): ActionType => ({
  type: SET_DATE_RANGE,
  payload: v,
});

export const setMissingDataPeriod = (v: Date[]): ActionType => ({
  type: SET_MISSING_DATA_DATE,
  payload: v,
});

export const setSearchQuery = (
  v: SearchQuery,
  p: URLSearchParams
): ActionType => ({
  type: SET_SEARCH_QUERY,
  payload: { query: v, params: p },
});

export const setSpeaker = (id: string, name: string): ActionType => ({
  type: SET_SPEAKER,
  payload: { name, id },
});

export const getSpeaker = (id: string): ActionType => ({
  type: GET_SPEAKER,
  payload: id,
});

const initState: ISearchAppState = {
  loading: true,
  speakerCache: new Map<string, string>(),
};

/**
 * Reducer of this store.
 */
const reducer = (
  state: ISearchAppState = initState,
  action: ActionType
): ISearchAppState => {
  switch (action.type) {
    case SET_RESULT:
      return { ...state, result: action.payload };
    case SET_LOADING:
      return { ...state, loading: action.payload };
    case SET_SEARCH_OPTIONS:
      return { ...state, speakerAttrs: action.payload };
    case SET_DATE_RANGE:
      return { ...state, dateRange: action.payload };
    case SET_MISSING_DATA_DATE:
      return { ...state, missingDataPeriod: action.payload };
    case SET_SEARCH_QUERY:
      return {
        ...state,
        searchQuery: action.payload.query,
        searchParams: action.payload.params,
      };
    case SET_SPEAKER: {
      const cache = new Map(state.speakerCache);
      const key = action.payload.id;
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size == CACHE_SIZE) {
        // Drop the oldest key
        cache.delete(cache.keys().next().value);
      }
      cache.set(key, action.payload.name);
      return { ...state, speakerCache: cache };
    }
    case GET_SPEAKER: {
      const cache = new Map(state.speakerCache);
      const key = action.payload;
      const value = cache.get(key);
      if (value) {
        // refresh key
        cache.delete(key);
        cache.set(key, value);
      }
      return { ...state, speakerCache: cache };
    }
    default:
      return state;
  }
};

const newStore: () => Store<ISearchAppState, ActionType> = () =>
  createStore(
    enableBatching(reducer)
    // window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
  );
export default newStore;
