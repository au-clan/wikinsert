/* eslint-disable jest/valid-expect */
/* eslint-disable jest/expect-expect */
import query from "../fixtures/query";
import * as result from "../fixtures/result";
import path from "path";
import yaml from "js-yaml";

describe("The result page", () => {
  it("successfully loads quotations", () => {
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
    );
    cy.visit("/", {
      onBeforeLoad(win) {
        cy.spy(win.navigator.clipboard, "writeText").as("copy");
      },
    });

    cy.get("input").type(query.text);
    cy.get('button[data-cy="submit"]').click();

    cy.location().should((loc) => {
      expect(loc.search).to.eq(
        "?target=quotation&text=hello+world&from_date=2010-01-01&to_date=2010-01-02"
      );
    });

    // Summary
    cy.get('span[data-cy="summary"]').contains("1 second.");
    cy.get('span[data-cy="summary"]').should("not.have.text", "more than");

    if (Cypress.browser.isHeaded) {
      // Share button
      cy.get('button[data-cy="copy-button"]').click();
      cy.get("@copy").should(
        "be.calledWithExactly",
        "http://localhost:8000/search?target=quotation&text=hello+world&from_date=2010-01-01&to_date=2010-01-02"
      );
    }

    // Download button
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.get('div[data-cy="download-menu"]').click();
    cy.get('div[data-cy="download-json"]').click();
    let filename = path.join(downloadsFolder, "quotebank.json");
    cy.readFile(filename, { timeout: 2000 }).should((obj) => {
      expect(obj.length).to.equal(11);
    });
    cy.get('div[data-cy="download-yaml"]').click();
    filename = path.join(downloadsFolder, "quotebank.txt");
    /* eslint-disable jest/valid-expect-in-promise */
    cy.readFile(filename, { timeout: 2000 })
      .then((str) => yaml.load(str))
      .should((obj) => {
        expect(obj.length).to.equal(11);
      });

    // Histogram
    cy.get("svg");

    // Next button
    cy.get('div[data-cy="next"]').should("have.length", 2);
    cy.get('div[data-cy="next"]').first().click();
    cy.get('div[data-cy="quotation"]').should("have.length", 1);
    cy.get('div[data-cy="quotation"]')
      .first()
      .find("div")
      .first()
      .should("have.text", "quotation-10");

    // Prev button
    cy.get('div[data-cy="prev"]').should("have.length", 2);
    cy.get('div[data-cy="prev"]').first().click();
    cy.get('div[data-cy="quotation"]').should("have.length", 10);
    cy.get('div[data-cy="quotation"]')
      .first()
      .find("div")
      .first()
      .should("have.text", "quotation-0");
  });

  it("successfully loads articles", () => {
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
      { method: "GET", url: "/api/article/search*" },
      result.ARTICLE_RESPONSE
    );

    cy.visit("/", {
      onBeforeLoad(win) {
        cy.spy(win.navigator.clipboard, "writeText").as("copy");
      },
    });

    cy.get('span[data-cy="menu"]').click();
    cy.get('div[data-cy="field-target"]').find("div").eq(1).click();
    cy.get('input[data-cy="searchBarInput"]').type(query.text);
    cy.get('button[data-cy="submit"]').click();

    // Next button
    cy.get('div[data-cy="next"]').should("have.length", 2);
    cy.get('div[data-cy="next"]').first().click();
    cy.get('div[data-cy="article"]').should("have.length", 1);
    cy.get('div[data-cy="article"]')
      .first()
      .find("div")
      .first()
      .should("have.text", "article-10");

    // Prev button
    cy.get('div[data-cy="prev"]').should("have.length", 2);
    cy.get('div[data-cy="prev"]').first().click();
    cy.get('div[data-cy="article"]').should("have.length", 10);
    cy.get('div[data-cy="article"]')
      .first()
      .find("div")
      .first()
      .should("have.text", "article-0");
  });

  it("successfully loads the top search bar", () => {
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
    cy.get('input[data-cy="field-speakerNationality"]')
      .clear()
      .type(query.country.name);
    cy.get('div[data-cy="speakerNationality-dropdown"]').first().click();
    cy.get('button[data-cy="submit"]').click();

    cy.location().should((loc) => {
      expect(loc.search).to.eq(
        "?target=quotation&text=hello+world&from_date=2010-01-01&to_date=2010-01-02&speaker_nationality=Q1"
      );
    });

    // Verify content of the search bar
    cy.get('input[data-cy="searchBarInput"]').should("have.value", query.text);
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speakerNationality"]').should(
      "have.value",
      query.country.name
    );

    // Search bar text input
    cy.get('input[data-cy="searchBarInput"]').clear().type(query.anotherText);
    cy.get('button[data-cy="submit"]').click();

    cy.location().should((loc) => {
      expect(loc.search).to.eq(
        "?target=quotation&text=foo+bar&from_date=2010-01-01&to_date=2010-01-02&speaker_nationality=Q1"
      );
    });
    cy.get('input[data-cy="searchBarInput"]').should(
      "have.value",
      query.anotherText
    );

    // Search bar other fields
    cy.get('input[data-cy="searchBarInput"]').clear();
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speakerGender"]').clear().type("foobar");
    cy.get('div[data-cy="speakerGender-dropdown"]')
      .children()
      .should("have.length", 1);
    cy.get('input[data-cy="field-speakerGender"]')
      .clear()
      .type(query.gender.name);
    cy.get('div[data-cy="speakerGender-dropdown"]').first().click();
    cy.get('button[data-cy="submit"]').click();
    cy.wait("@get");
    cy.get("@get").should((req) => {
      const params = new URL(req.request.url).searchParams;
      expect(params.get("target")).to.equal("quotation");
      expect(params.get("text")).to.equal(null);
      expect(params.get("speaker_gender")).to.equal(query.gender.id);
      expect(params.get("speaker_nationality")).to.equal(query.country.id);
      expect(params.get("from_date")).to.equal(query.fromDate);
      expect(params.get("to_date")).to.equal(query.toDate);
    });

    cy.location().should((loc) => {
      expect(loc.search).to.eq(
        "?target=quotation&from_date=2010-01-01&to_date=2010-01-02&speaker_nationality=Q1&speaker_gender=Q2"
      );
    });
    cy.get('input[data-cy="searchBarInput"]').should("have.value", "");
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speakerNationality"]').should(
      "have.value",
      query.country.name
    );
    cy.get('input[data-cy="field-speakerGender"]').should(
      "have.value",
      query.gender.name
    );
  });

  it("successfully loads quotations from sample queries", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    ).as("get_date");
    cy.intercept(
      { method: "GET", url: "/api/quotation/search/sample" },
      result.SAMPLE_QUOTAION_RESPONSE
    ).as("get_result");
    cy.intercept(
      { method: "GET", url: "/api/speaker/id/*" },
      result.SPEAKER_RESPONSE
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
    cy.visit("/");
    cy.wait("@get_date");
    cy.get('div[data-cy="feeling-lucky"]').click();
    cy.wait("@get_result");
    cy.location().should((loc) => {
      expect(loc.search).to.eq(
        "?target=quotation&text=hello+world&speaker=Q123&from_date=2010-01-01&to_date=2010-01-02"
      );
    });

    // Search bar
    cy.get('input[data-cy="searchBarInput"]').should(
      "have.value",
      result.SAMPLE_QUOTAION_RESPONSE.query.text
    );
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speaker"]').should(
      "have.value",
      result.SPEAKER_RESPONSE.name
    );
  });

  it("loads content when a user accesses with a link directly", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    ).as("get_date");
    cy.intercept(
      { method: "GET", url: "/api/quotation/search*" },
      result.QUOTATION_RESPONSE
    ).as("get");
    cy.intercept(
      { method: "GET", url: "/api/speaker/id/*" },
      result.SPEAKER_RESPONSE
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
    cy.visit(
      "/search?target=quotation&text=hello+world&speaker=Q1&from_date=2010-01-01&to_date=2010-01-02"
    );
    cy.wait("@get");
    cy.get("@get").should((req) => {
      const params = new URL(req.request.url).searchParams;
      expect(params.get("target")).to.equal("quotation");
      expect(params.get("text")).to.equal(query.text);
      expect(params.get("speaker")).to.equal("Q1");
      expect(params.get("from_date")).to.equal(query.fromDate);
      expect(params.get("to_date")).to.equal(query.toDate);
    });

    // Search bar
    cy.get('input[data-cy="searchBarInput"]').should(
      "have.value",
      result.SAMPLE_QUOTAION_RESPONSE.query.text
    );
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speaker"]').should(
      "have.value",
      result.SPEAKER_RESPONSE.name
    );

    // Check if results are displayed properly
    cy.get('span[data-cy="menu"]').click();
    cy.get('div[data-cy="next"]').first().click();
    cy.get('div[data-cy="quotation"]').should("have.length", 1);
    cy.get('div[data-cy="quotation"]')
      .first()
      .find("div")
      .first()
      .should("have.text", "quotation-10");
  });

  it("shows correct placeholders in the search bar", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    ).as("get_date");
    cy.intercept(
      { method: "GET", url: "/api/quotation/search*" },
      result.QUOTATION_RESPONSE
    ).as("get");
    cy.intercept(
      { method: "GET", url: "/api/speaker/id/*" },
      result.SPEAKER_RESPONSE
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
    cy.visit(
      "/search?target=quotation&text=hello+world&speaker=Q1&from_date=2010-01-01&to_date=2010-01-02"
    );
    cy.wait("@get");

    // Search bar with text search param
    cy.get('input[data-cy="searchBarInput"]').should(
      "have.value",
      result.SAMPLE_QUOTAION_RESPONSE.query.text
    );
    cy.get('span[data-cy="menu"]').click();
    cy.get('input[data-cy="field-speaker"]').should(
      "have.value",
      result.SPEAKER_RESPONSE.name
    );

    // Search bar without text search param
    cy.visit(
      "/search?target=quotation&speaker=Q1&from_date=2010-01-01&to_date=2010-01-02"
    );
    cy.wait("@get");
    cy.get('input[data-cy="searchBarInput"]').should("have.value", "");
    cy.get('div[data-cy="search-bar-placeholder"]').should(
      "contain",
      `speaker: ${result.SPEAKER_RESPONSE.name}`
    );
  });

  it("sorts results", () => {
    cy.intercept(
      {
        method: "GET",
        url: "/api/data/date_range",
      },
      { from_date: query.fromDate, to_date: query.toDate }
    ).as("get_date");
    cy.intercept(
      { method: "GET", url: "/api/quotation/search*" },
      result.QUOTATION_RESPONSE
    ).as("get");
    cy.intercept(
      { method: "GET", url: "/api/speaker/id/*" },
      result.SPEAKER_RESPONSE
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
    cy.visit(
      "/search?target=quotation&text=hello+world&speaker=Q1&from_date=2010-01-01&to_date=2010-01-02"
    );
    cy.wait("@get");

    // Check sorted results
    cy.get('span[data-cy="menu"]').click();
    cy.get('select[data-cy="sort-select"]').select("Speaker name (descending)");
    cy.get('div[data-cy="quotation"]')
      .first()
      .find("div")
      .first()
      .should("have.text", "quotation-10");
  });
});
