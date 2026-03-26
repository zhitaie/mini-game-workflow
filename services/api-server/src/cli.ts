import { startServer } from './server.js';

function readPort(): number | undefined {
  const raw = process.env.API_PORT;

  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

const server = await startServer({
  host: process.env.API_HOST,
  port: readPort(),
  database: {
    filePath: process.env.API_DB_FILE
  }
});

console.log(
  JSON.stringify(
    {
      name: 'api-server',
      url: server.url,
      databaseFilePath: server.databaseFilePath
    },
    null,
    2
  )
);
