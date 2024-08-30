import {
  QueryTarget,
  NIL_ENTITY,
  FullFormValues,
  SearchQuery,
  SpeakerAttrs,
  IAttrCandidates,
} from "src/api";

import moment from "moment";

const dateFormat = "YYYY-MM-DD HH:mm:ss";

export const formatDate = (d: Date): string => {
  let month = "" + (d.getMonth() + 1),
    day = "" + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
};

export const parseDate = (dateString: string) : Date => {
  return new Date(moment(dateString, dateFormat).toDate());
}

export const parseQueryParams = (
  rawQuery: string
): { ok: boolean[]; values: FullFormValues } => {
  const params = new URLSearchParams(rawQuery);
  const target =
    params.get("target") === QueryTarget.ARTICLE
      ? QueryTarget.ARTICLE
      : QueryTarget.QUOTATION;

  const numOccurrences = parseInt(params.get("num_occurrences") || "0", 10);
  const values = {
    target,
    fromDate: new Date(params.get("from_date") || ""),
    toDate: new Date(params.get("to_date") || ""),
    text: params.get("text") || "",
    speaker: { ...NIL_ENTITY, id: params.get("speaker") || "" },
    domain: params.get("domain") || "",
    numOccurrences:
      Number.isInteger(numOccurrences) && numOccurrences > 1
        ? numOccurrences.toString()
        : "",
    speakerNationality: {
      ...NIL_ENTITY,
      id: params.get("speaker_nationality") || "",
    },
    speakerGender: { ...NIL_ENTITY, id: params.get("speaker_gender") || "" },
    speakerOccupation: {
      ...NIL_ENTITY,
      id: params.get("speaker_occupation") || "",
    },
    withContext: (params.get("with_context") || "") === "true",
    exactMatch: (params.get("exact_match") || "") === "true",
  };

  return {
    ok: [
      !isNaN(values.fromDate.getTime()),
      !isNaN(values.toDate.getTime()),
      !!values.text,
      !!values.speaker.id,
      !!values.domain,
      !!values.numOccurrences,
      !!values.speakerNationality.id,
      !!values.speakerGender.id,
      !!values.speakerOccupation.id,
      values.withContext,
      values.exactMatch,
    ],
    values,
  };
};

export const composePermalink = (values: FullFormValues): URLSearchParams => {
  const params = new URLSearchParams(convertValueToQuery(values));
  // Remove empty params
  const emptyKeys: string[] = [];
  params.forEach((v, k) => {
    if (!v) {
      emptyKeys.push(k);
    }
  });
  emptyKeys.forEach((k) => params.delete(k));
  return params;
};

export const convertValueToQuery = (values: FullFormValues): SearchQuery => ({
  target: values.target,
  text: values.text,
  speaker: values.target === QueryTarget.QUOTATION ? values.speaker.id : "",
  domain: values.target === QueryTarget.QUOTATION ? values.domain : "",
  from_date: formatDate(values.fromDate),
  to_date: formatDate(values.toDate),
  num_occurrences:
    values.target === QueryTarget.QUOTATION &&
    parseInt(values.numOccurrences, 10) > 1
      ? values.numOccurrences
      : "",
  speaker_nationality:
    values.target === QueryTarget.QUOTATION ? values.speakerNationality.id : "",
  speaker_gender:
    values.target === QueryTarget.QUOTATION ? values.speakerGender.id : "",
  speaker_occupation:
    values.target === QueryTarget.QUOTATION ? values.speakerOccupation.id : "",
  with_context:
    values.target === QueryTarget.ARTICLE && values.withContext ? "true" : "",
  exact_match: values.exactMatch ? "true" : "",
});

export const getAttrsFromMisc = (misc: SpeakerAttrs): IAttrCandidates => {
  const attrCandidates: IAttrCandidates = {
    country: Object.entries(misc.country).map(([k, v]) => ({
      id: v,
      name: k,
    })),
    gender: Object.entries(misc.gender).map(([k, v]) => ({
      id: v,
      name: k,
    })),
    occupation: Object.entries(misc.occupation).map(([k, v]) => ({
      id: v,
      name: k,
    })),
  };
  return attrCandidates;
};
