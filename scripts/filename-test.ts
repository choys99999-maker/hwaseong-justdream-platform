// 파일 이름 겹침 처리 회귀 테스트.
//
// 읍면동마다 같은 서식을 내려받아 쓰기 때문에 파일 이름이 그대로 겹친다.
// 겹칠 때 어떤 이름을 제안하는지, 그 이름이 정말 안 겹치는지 확인한다.
//
//   npm run test:filename
import {
  fileNameKey,
  findSameOrganizationConflicts,
  suggestUniqueFileName,
} from '../src/utils/submission';

const failures: string[] = [];
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${label}\n      기대: ${e}\n      실제: ${a}`);
}

const FORM = '화성형 그냥드림 실적(주별보고, 연계실적 샘플).xlsx';

// ── 비교 키 ────────────────────────────────────────────────
check('앞뒤 공백은 같은 이름으로 본다', fileNameKey(` ${FORM} `), fileNameKey(FORM));
check('대소문자는 같은 이름으로 본다', fileNameKey('Report.XLSX'), fileNameKey('report.xlsx'));
check(
  '자모 조합이 달라도 같은 이름으로 본다',
  fileNameKey('봉담읍.xlsx'.normalize('NFD')),
  fileNameKey('봉담읍.xlsx'),
);
check('다른 이름은 다르게 본다', fileNameKey('a.xlsx') === fileNameKey('b.xlsx'), false);

// ── 겹침 판정: 같은 동 안에서만 ────────────────────────────
{
  const 봉담 = 'org-bongdam';
  const 향남 = 'org-hyangnam';
  const registered = [
    { fileName: FORM, organizationId: 봉담 },
    { fileName: '다른자료.xlsx', organizationId: 봉담 },
    { fileName: FORM, organizationId: 향남 },
  ];

  // 다른 동이 같은 이름을 써도 막지 않는다. 목록에 기관명이 함께 나온다.
  check('다른 동의 같은 이름은 겹침이 아니다',
    findSameOrganizationConflicts(registered, FORM, 'org-dongtan').length, 0);

  // 같은 동에서 같은 이름이면 물어봐야 한다.
  check('같은 동의 같은 이름은 겹침이다',
    findSameOrganizationConflicts(registered, FORM, 봉담).map((r) => r.fileName), [FORM]);

  // 향남읍도 자기 동 것만 본다. 봉담읍 자료는 세지 않는다.
  check('각 동은 자기 동 자료만 본다',
    findSameOrganizationConflicts(registered, FORM, 향남).length, 1);

  check('이름이 다르면 겹치지 않는다',
    findSameOrganizationConflicts(registered, '새자료.xlsx', 봉담).length, 0);

  // 표기 차이로 빠져나가지 못한다.
  check('표기가 달라도 같은 이름으로 잡는다',
    findSameOrganizationConflicts(registered, ` ${FORM.toUpperCase()} `, 봉담).length, 1);

  check('기관을 아직 안 골랐으면 판정하지 않는다',
    findSameOrganizationConflicts(registered, FORM, '').length, 0);

  // 이름을 바꾸면 겹침이 풀려야 한다. (바꾼 뒤 이어서 진행할 수 있어야 한다)
  const renamed = suggestUniqueFileName(
    FORM,
    registered.filter((r) => r.organizationId === 봉담).map((r) => r.fileName),
    '봉담읍',
  );
  check('제안한 이름은 같은 동에서 겹치지 않는다',
    findSameOrganizationConflicts(registered, renamed, 봉담).length, 0);
}

// ── 이름 제안 ──────────────────────────────────────────────
{
  // 읍면동 이름을 앞에 붙이는 것이 가장 알아보기 쉽다.
  const suggested = suggestUniqueFileName(FORM, [FORM], '봉담읍');
  check('읍면동 이름을 앞에 붙인다', suggested, `봉담읍_${FORM}`);
  check('확장자는 그대로 둔다', suggested.endsWith('.xlsx'), true);
}

{
  // 제안한 이름마저 이미 쓰이고 있으면 번호를 붙인다.
  const taken = [FORM, `봉담읍_${FORM}`];
  const suggested = suggestUniqueFileName(FORM, taken, '봉담읍');
  check('제안 이름도 겹치면 번호를 붙인다', suggested, `봉담읍_화성형 그냥드림 실적(주별보고, 연계실적 샘플) (2).xlsx`);
  check('그 이름은 쓰이지 않은 이름이다', taken.map(fileNameKey).includes(fileNameKey(suggested)), false);
}

{
  // 읍면동을 아직 고르지 않았으면 번호만 붙인다.
  const suggested = suggestUniqueFileName(FORM, [FORM]);
  check('기관 이름이 없으면 번호만 붙인다', suggested, '화성형 그냥드림 실적(주별보고, 연계실적 샘플) (2).xlsx');
}

{
  // 이미 읍면동 이름이 들어 있는 파일에 또 붙이지 않는다.
  const name = '봉담읍_실적.xlsx';
  check('이름에 이미 기관명이 있으면 다시 붙이지 않는다',
    suggestUniqueFileName(name, [name], '봉담읍'), '봉담읍_실적 (2).xlsx');
}

{
  // 여러 번 겹쳐도 결국 안 겹치는 이름이 나와야 한다. (사용자가 계속 누를 수 있다)
  const taken = [FORM];
  let name = FORM;
  for (let i = 0; i < 5; i++) {
    name = suggestUniqueFileName(name, taken, '봉담읍');
    check(`${i + 1}번째 제안이 기존 이름과 겹치지 않는다`,
      taken.map(fileNameKey).includes(fileNameKey(name)), false);
    taken.push(name);
  }
}

{
  // 확장자가 없는 이름도 깨지지 않는다.
  check('확장자 없는 이름', suggestUniqueFileName('보고서', ['보고서'], '봉담읍'), '봉담읍_보고서');
}

console.log('─'.repeat(70));
if (failures.length === 0) {
  console.log(`✅ 파일 이름 처리 ${checks}개 검사 모두 통과`);
  process.exit(0);
} else {
  console.log(`❌ ${checks}개 검사 중 ${failures.length}건 실패\n`);
  for (const failure of failures) console.log(`   ${failure}\n`);
  process.exit(1);
}
