import { searchMemoryCaptures } from '../src/lib/memory-capture';
import { buildPrototypeCorpus } from '../src/lib/memory-capture-fixtures';

const query = process.argv[2] ?? 'queryable';
const corpus = buildPrototypeCorpus();
const hits = searchMemoryCaptures(corpus, query);

console.log(`Memory capture prototype — ${corpus.length} captures, query "${query}"`);
console.log('—'.repeat(60));

if (hits.length === 0) {
  console.log('No hits.');
  process.exit(0);
}

for (const hit of hits) {
  console.log(`\n[${hit.source.kind}] ${hit.title}`);
  console.log(`  source: ${hit.source.label}`);
  console.log(`  url:    ${hit.source.url}`);
  console.log(`  time:   ${hit.capturedAt}`);
  console.log(`  match:  ${hit.matchedFields.join(', ')}`);
  console.log(`  snippet: ${hit.snippet}`);
  if (hit.annotationContext) {
    console.log(`  annotation: ${hit.annotationContext}`);
  }
}

console.log('\n' + '—'.repeat(60));
console.log(`${hits.length} hit(s). Run: pnpm test -- memory-capture`);
