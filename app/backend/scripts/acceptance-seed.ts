import { runAcceptanceSeed } from './seed-acceptance';

runAcceptanceSeed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
