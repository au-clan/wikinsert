/* eslint-disable jest/valid-expect */
import query from "../fixtures/query";
import * as result from "../fixtures/result";

describe("The search interface", () => {
  it("successfully loads simple mode", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    );
    cy.intercept(
      { method: "GET", url: "/api/quotation/search*" },
      result.QUOTATION_RESPONSE
    ).as("get");
    cy.visit("/");

    cy.get("input").type(query.text);
    cy.get('button[data-cy="submit"]').click();
    cy.wait("@get");
    cy.get("@get").should((req) => {
      const params = new URL(req.request.url).searchParams;
      expect(params.get("target")).to.equal("quotation");
      expect(params.get("text")).to.equal(query.text);
      expect(params.get("from_date")).to.equal(query.fromDate);
      expect(params.get("to_date")).to.equal(query.toDate);
    });
  });

  it("successfully loads advanced mode", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    );
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/speaker_attr/",
      },
      {
        country: { [query.country.name]: query.country.id },
        gender: { [query.gender.name]: query.gender.id },
        occupation: { [query.occupation.name]: query.occupation.id },
      }
    );
    cy.intercept(
      {
        method: "GET",
        url: "/api/speaker/search?target=speaker&keyword=A",
      },
      {
        speakers: [
          { name: "A", id: "Q1", description: "desc", aliases: ["B", "C"] },
        ],
      }
    );
    cy.intercept(
      {
        method: "GET",
        url: "/api/speaker/search?target=speaker&keyword=B",
      },
      { speakers: [] }
    );
    cy.intercept(
      { method: "GET", url: "/api/quotation/search*" },
      result.QUOTATION_RESPONSE
    ).as("get");

    cy.visit("/");
    cy.get('span[data-cy="menu"]').click();

    // Auto-complete fields
    const speakerFieldValues = {
      speaker: "A",
      speakerNationality: "country",
      speakerGender: "gender",
      speakerOccupation: "occupation",
    };
    for (const [fieldName, value] of Object.entries(speakerFieldValues)) {
      cy.get(`input[data-cy="field-${fieldName}"]`).clear().type(value);
      cy.get(`div[data-cy="${fieldName}-dropdown"]`)
        .children()
        .should("have.length", 1);
      cy.get(`div[data-cy="${fieldName}-dropdown"]`)
        .first()
        .should("contain", value);
      cy.get(`input[data-cy="field-${fieldName}"]`).clear();
    }
    // Auto-complete not found
    cy.get('input[data-cy="field-speaker"]').clear().type("B");
    cy.get('div[data-cy="speaker-dropdown"]')
      .children()
      .should("have.length", 1);
    cy.get('div[data-cy="speaker-dropdown"]')
      .first()
      .should("contain", "No matching entry");

    cy.get('input[data-cy="field-speaker"]').clear().type("A");
    cy.get('div[data-cy="speaker-dropdown"]').first().click();

    cy.get('input[data-cy="field-domain"]').clear().type(query.domain);

    // Close menu and re-open => should find the selected option
    cy.get('span[data-cy="menu"]').click();
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speaker"]').should("have.value", "A");
    cy.get('input[data-cy="field-domain"]').should("have.value", query.domain);

    // Text field
    cy.get('input[data-cy="searchBarInput"]').type(query.text);
    cy.get('button[data-cy="submit"]').click();
    cy.wait("@get");
    cy.get("@get").should((req) => {
      const params = new URL(req.request.url).searchParams;
      expect(params.get("target")).to.equal("quotation");
      expect(params.get("text")).to.equal(query.text);
      expect(params.get("speaker")).to.equal("Q1");
      expect(params.get("domain")).to.equal(query.domain);
      expect(params.get("from_date")).to.equal(query.fromDate);
      expect(params.get("to_date")).to.equal(query.toDate);
    });
  });

  it("works with a blank date field in advanced mode", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    );
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/speaker_attr/",
      },
      {
        country: { [query.country.name]: query.country.id },
        gender: { [query.gender.name]: query.gender.id },
        occupation: { [query.occupation.name]: query.occupation.id },
      }
    );

    cy.intercept(
      { method: "GET", url: "/api/quotation/search*" },
      result.QUOTATION_RESPONSE
    ).as("get");

    cy.visit("/");
    cy.get('input[data-cy="searchBarInput"]').type(query.text);
    cy.get('span[data-cy="menu"]').click();
    cy.get('div[data-cy="date-from"] input').clear();
    cy.get('div[data-cy="date-to"] input').clear();
    cy.get('button[data-cy="submit"]').click();
    cy.wait("@get");
    cy.get("@get").should((req) => {
      const params = new URL(req.request.url).searchParams;
      expect(params.get("target")).to.equal("quotation");
      expect(params.get("text")).to.equal(query.text);
      expect(params.get("from_date")).to.equal(query.fromDate);
      expect(params.get("to_date")).to.equal(query.toDate);
    });
  });
});
