// 엑셀 해석 엔진 회귀 테스트 실행기.
// 엔진은 TypeScript라 Node에서 바로 못 돌린다. CommonJS로 한 번 컴파일한 뒤 실행한다.
// (프로젝트가 "type": "module" 이라 출력 폴더에 commonjs 표시를 따로 남긴다)
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, '.tmp-engine-test');

rmSync(outDir, { recursive: true, force: true });

const build = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'scripts/tsconfig.engine-test.json')],
  { cwd: root, stdio: 'inherit' },
);
if (build.status !== 0) process.exit(build.status ?? 1);

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'package.json'), '{ "type": "commonjs" }\n');

// 실행할 테스트를 인자로 고른다. 없으면 전부 돌린다.
const targets = process.argv.slice(2);
const scripts =
  targets.length > 0 ? targets : ['excel-engine-test', 'filename-test', 'inventory-text-test'];
for (const name of scripts) {
  const run = spawnSync(process.execPath, [resolve(outDir, `scripts/${name}.js`)], {
    cwd: root,
    stdio: 'inherit',
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
process.exit(0);
