const express = require("express");

const app = express();
const port = process.env.PORT || 8080;

app.use("/", express.static(`${__dirname}/build`));

app.get("*", (_, res) => {
  res.sendFile(`${__dirname}/build/index.html`);
});

app.listen(port, () => {
  console.log(`Quotebank UI server listening to port ${port}`);
});
