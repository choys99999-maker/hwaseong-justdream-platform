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

const run = spawnSync(process.execPath, [resolve(outDir, 'scripts/excel-engine-test.js')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(run.status ?? 1);
