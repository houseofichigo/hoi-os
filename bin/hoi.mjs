#!/usr/bin/env node
try {
  const { main } = await import('../dist/core/cli.js');
  await main();
} catch (error) {
  const message = error.code === 'ERR_MODULE_NOT_FOUND' ? 'Build HOI OS first: npm run build' : error.message;
  console.error(JSON.stringify({ error: message }));
  process.exitCode = 1;
}
