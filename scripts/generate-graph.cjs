#!/usr/bin/env node
/**
 * docs/dependency-graph.md 를 dependency-cruiser 의 실제 분석으로부터 재생성.
 * 사용: npm run docs:graph
 */
const { execSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const mermaid = execSync(
  'npx depcruise --output-type mermaid src',
  { encoding: 'utf8', shell: true },
).trim();

const header = `# Dependency Graph

\`dependency-cruiser\` 가 실제 import 그래프를 분석해 자동 생성한 다이어그램입니다.

**재생성**: \`npm run docs:graph\`

> ⚠️ 이 파일은 자동 생성됩니다. 수동 편집하지 마세요 — \`npm run docs:graph\` 가 덮어씁니다.

## src 모듈 의존성

\`\`\`mermaid
${mermaid}
\`\`\`
`;

const out = join(__dirname, '..', 'docs', 'dependency-graph.md');
writeFileSync(out, header, 'utf8');
console.log(`✓ Wrote ${out}`);
