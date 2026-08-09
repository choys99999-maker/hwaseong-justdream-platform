import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderClosed, Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useCentralData } from '../hooks/useCentralData';
import { deleteSubmission, getSubmissionDetail } from '../store/remote';
import { districtOfArea } from '../data/districtByArea';
import {
  displayCellValue,
  formatPeriod,
  formatUpdatedAt,
  isPersonalColumn,
  sheetTypeLabel,
} from '../utils/submission';

const PREVIEW_ROWS = 20;

export default function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [sheetIdx, setSheetIdx] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: detail, error, isLoading } = useCentralData(
    () => getSubmissionDetail(submissionId ?? ''),
    [submissionId],
  );

  const backLink = (
    <Link
      to="/files"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
    >
      <ArrowLeft size={16} /> 자료 관리
    </Link>
  );

  if (isLoading) return null;

  if (error || !detail) {
    return (
      <div className="mx-auto w-full max-w-[1080px] space-y-6">
        {backLink}
        <EmptyState
          icon={FolderClosed}
          title="자료를 찾을 수 없습니다"
          message={error ?? '삭제되었거나 잘못된 주소입니다.'}
        />
      </div>
    );
  }

  const summary = detail.summary;
  // 제출 기관(읍면동)이 속한 구. 지도·집계와 같은 행정동 경계 데이터에서 찾는다.
  const districtId = districtOfArea(summary.organizationName);
  const sheets = detail.sheets;
  const sheet = sheets[Math.min(sheetIdx, Math.max(sheets.length - 1, 0))];
  const hasPersonalColumn = (sheet?.columns ?? []).some(isPersonalColumn);
  const period =
    summary.periodStart && summary.periodEnd
      ? formatPeriod(summary.periodStart, summary.periodEnd)
      : null;

  async function handleDelete() {
    if (!window.confirm('이 자료를 삭제하시겠습니까? 통합 현황에서도 함께 빠집니다.')) return;
    try {
      await deleteSubmission(summary.id);
      navigate('/files');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '자료 삭제에 실패했습니다.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <div className="mb-4">{backLink}</div>

      <PageHeader
        title={summary.organizationName}
        description={`${summary.types.map((t) => t.label).join(' · ') || '내용 없음'} · ${summary.recordCount.toLocaleString()}건`}
        actions={
          <div className="flex items-center gap-2">
            {districtId && (
              <Link
                to={`/regions/${districtId}`}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                지역 현황에서 보기
              </Link>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-5">
        <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
          <Row label="지역">
            {summary.organizationName}
            <span className="ml-2 text-xs text-slate-400">{summary.regionName}</span>
          </Row>
          <Row label="기간">{period ?? '—'}</Row>
          <Row label="제출 일시">{formatUpdatedAt(summary.uploadedAt)}</Row>
          <Row label="상태">
            {summary.isSuperseded ? (
              <span className="text-slate-500">대체됨 · 이후 제출본으로 교체</span>
            ) : summary.issueCount > 0 ? (
              <span className="text-amber-600">
                확인 필요 {summary.issueCount.toLocaleString()}건
              </span>
            ) : (
              '제출완료'
            )}
          </Row>
          <Row label="원본 파일">
            <span className="break-all">{summary.fileName}</span>
          </Row>
          <Row label="시트">{sheets.length}개</Row>
        </dl>

        {summary.types.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-4">
            {summary.types.map((t) => (
              <li key={t.type} className="text-sm text-slate-600">
                {t.label}
                <span className="ml-2 font-semibold tabular-nums text-slate-800">
                  {t.count.toLocaleString()}건
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5">
        <h3 className="text-base font-semibold text-slate-900">자료 미리보기</h3>

        {sheets.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sheets.map((s, idx) => (
              <button
                key={s.sheetName}
                type="button"
                onClick={() => setSheetIdx(idx)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  idx === Math.min(sheetIdx, sheets.length - 1)
                    ? 'bg-slate-100 text-slate-800'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {sheetTypeLabel(s.sheetType)}
                <span className="ml-1.5 text-slate-400">{s.records.length.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        {!sheet || sheet.columns.length === 0 || sheet.records.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">표시할 내용이 없습니다.</p>
        ) : (
          <>
            <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {sheet.columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {sheet.records.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i}>
                      {sheet.columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-4 py-2 text-slate-600">
                          {displayCellValue(col, row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-xs text-slate-400">
              전체 {sheet.records.length.toLocaleString()}건 중 처음{' '}
              {Math.min(PREVIEW_ROWS, sheet.records.length)}건
              {hasPersonalColumn && ' · 이름·생년월일·주소 등 개인정보 항목은 가려서 표시합니다.'}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-50 pb-2.5">
      <dt className="shrink-0 text-sm text-slate-400">{label}</dt>
      <dd className="text-right text-sm text-slate-700">{children}</dd>
    </div>
  );
}
