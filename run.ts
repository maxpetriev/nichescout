import { runAgent } from './lib/agent';

const prompt = process.argv[2];
if (!prompt) {
  console.error('Usage: npm run cli "<research prompt>"');
  console.error('Example: npm run cli "what\'s going on in ai agent infra space right now"');
  process.exit(1);
}

const platforms = process.argv[3] === 'both' ? ['x', 'reddit'] as const : ['x'] as const;

runAgent(prompt, [...platforms]).catch(err => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
