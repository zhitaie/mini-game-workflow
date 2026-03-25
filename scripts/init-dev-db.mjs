import { initializeDevelopmentDatabase } from '../services/api-server/dist/services/api-server/src/db/bootstrap.js';

const filePath = process.argv[2] ?? '.data/dev.sqlite';
const database = initializeDevelopmentDatabase({
  filePath
});

console.log(
  JSON.stringify(
    {
      provider: database.provider,
      filePath: database.filePath,
      seeded: true
    },
    null,
    2
  )
);

database.close();
