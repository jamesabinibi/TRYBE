const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const patch = `
  // Global 404 handler for API routes to prevent HTML fallbacks
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found: ' + req.originalUrl });
  });

  server.listen(PORT, "0.0.0.0", () => {`;
const newContent = content.replace('  server.listen(PORT, "0.0.0.0", () => {', patch);
fs.writeFileSync('server.ts', newContent);
