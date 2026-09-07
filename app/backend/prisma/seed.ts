import { runDemoSeed } from '../scripts/seed-demo';

runDemoSeed().catch((error) => {
  console.error('❌ Demo seed failed:', error);
  process.exit(1);
});
