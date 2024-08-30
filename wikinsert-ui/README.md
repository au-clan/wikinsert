# Quotebank UI

## Settings
Copy `config.template.json` to `config.json` and fill in the file:
* `API_SERVER`: URI of the API server, e.g., `http://localhost:8000`
* `FEEDBACK_FORM_URL`: URL to the feedback form
* `LAB_PAGE_URL`: URL to the lab homepage

## Run
```bash
yarn d
```

See `package.json` for more commands.

## Testing

### End-to-end (E2E) tests

Cypress is utilised for E2E tests.

#### Setup
```bash
# For Ubuntu
apt-get install libgtk2.0-0 \
  libgtk-3-0 libgbm-dev libnotify-dev \
  libgconf-2-4 libnss3 libxss1 \
  libasound2 libxtst6 xauth xvfb
```

Copy `cypress.template.json` to `cypress.json` and fill in the file:
* `baseUrl`: the domain of your UI instance. For example, `http://localhost:8080`.

#### Run the tests
```bash
yarn t:e2e
```
