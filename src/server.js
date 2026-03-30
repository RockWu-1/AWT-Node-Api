require("dotenv").config();
const app = require("./app");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AWT API listening on port ${port}`);
});