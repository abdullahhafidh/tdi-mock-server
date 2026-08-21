const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TDI mock server listening on http://localhost:${PORT} (docs at /docs)`);
});
