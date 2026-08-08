import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  RotateCcw,
  Upload,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import ColumnMapper from '../components/upload/ColumnMapper';
import ExcelPreview, { pickDefaultSheetName } from '../components/upload/ExcelPreview';
import {
  autoMapColumns,
  checkRecognition,
  getColumnsForType,
  isCumulativeSheet,
  PERFORMANCE_COLUMNS,
  REFERRAL_COLUMNS,
  GENERIC_COLUMNS,
} from '../utils/columnMapping';
import { sheetTypeLabel } from '../utils/submission';
import { isCentralStoreEnabled } from '../lib/supabase';
import {
  listOrganizations,
  saveSubmission,
  type Organization,
  type SheetPayload,
} from '../store/remote';
import type {
  SheetParseResult,
  SheetConvertResult,
  PlatformColumnKey,
} from '../types/upload';

const ALL_FIELD_LABELS: Record<string, string> = {};
for (const def of [...PERFORMANCE_COLUMNS, ...REFERRAL_COLUMNS, ...GENERIC_COLUMNS]) {
  if (!ALL_FIELD_LABELS[def.key]) ALL_FIELD_LABELS[def.key] = def.label;
}

/** 오류가 많아도 기본 화면에는 몇 개만. 나머지는 "모두 보기"로. */
const COLLAPSED_ERRORS = 3;
const MAX_LISTED_ERRORS = 50;

type Step = 'select' | 'uploading' | 'review' | 'importing' | 'done';

/** 확인 화면은 세 상태 중 하나만 보여준다. 섞지 않는다. */
type ReviewState = 'checking' | 'unrecognized' | 'invalid' | 'ready';

interface ErrorItem {
  label: string;
  cell: string;
  message: string;
}

/** 마지막으로 선택한 제출 기관. 다음 업로드 때 기본값으로 쓴다. */
const ORG_KEY = 'jd-org-id';

export default function DataUploadPage() {
  const [step, setStep] = useState<Step>('select');
  const [sheets, setSheets] = useState<SheetParseResult[]>([]);
  const [activeSheetName, setActiveSheetName] = useState('');
  const [sheetMappings, setSheetMappings] = useState<
    Record<string, Record<string, PlatformColumnKey | null>>
  >({});
  const [initialMappings, setInitialMappings] = useState<
    Record<string, Record<string, PlatformColumnKey | null>>
  >({});
  /** 저장 전 검증 결과. null이면 아직 확인 중. */
  const [checkResults, setCheckResults] = useState<SheetConvertResult[] | null>(null);
  const [convertResults, setConvertResults] = useState<SheetConvertResult[]>([]);
  const [savedSheetCount, setSavedSheetCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  /** 관리자용 직접 연결(ColumnMapper)은 눌렀을 때만 화면에 올린다. */
  const [showAdvanced, setShowAdvanced] = useState(false);
  /** 중앙 저장소용 제출 기관(읍면동). 파일명에서 추론하지 않고 명시적으로 고른다. */
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_KEY) ?? '');
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileNameRef = useRef('');
  /** Storage 업로드용 원본 파일. (worker에는 버퍼가 transfer되어 넘어간다) */
  const fileRef = useRef<File | null>(null);

  // 워커 콜백은 한 번만 만들어지므로, 저장에 필요한 최신 값을 ref로 들고 있는다.
  const sheetsRef = useRef<SheetParseResult[]>([]);
  sheetsRef.current = sheets;
  const sheetMappingsRef = useRef(sheetMappings);
  sheetMappingsRef.current = sheetMappings;
  /** 같은 convert-done 메시지를 검증용/저장용으로 나눠 받는다. */
  const convertPurposeRef = useRef<'check' | 'save'>('check');
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  function mappedKeysOf(
    sheet: SheetParseResult,
    mappings: Record<string, Record<string, PlatformColumnKey | null>>,
  ): Set<PlatformColumnKey> {
    const mapping = mappings[sheet.sheetName] ?? {};
    return new Set(Object.values(mapping).filter((v): v is PlatformColumnKey => v !== null));
  }

  /**
   * 업무 자료로 인정되는 시트인지. 필수 항목뿐 아니라 핵심 열 그룹까지 본다.
   * (기관명 하나만 맞아도 "정상"으로 통과해 실적 숫자가 통째로 빠지던 문제)
   */
  function isSheetRecognized(sheet: SheetParseResult, mappings = sheetMappingsRef.current): boolean {
    return checkRecognition(sheet.sheetType, mappedKeysOf(sheet, mappings)).ok;
  }

  /** 저장 대상 시트만 골라 중앙 저장소가 받을 모양으로 만든다. */
  function buildPayloads(results: SheetConvertResult[]): SheetPayload[] {
    const payloads: SheetPayload[] = [];
    for (const result of results) {
      const sheet = sheetsRef.current.find((s) => s.sheetName === result.sheetName);
      if (!sheet || !isSheetRecognized(sheet)) continue;
      payloads.push({
        sheetName: result.sheetName,
        sheetType: sheet.sheetType,
        errorCount: result.errors.length,
        isCumulative: isCumulativeSheet(result.sheetName),
        // worker가 만든 camelCase 정규화 레코드(숫자·ISO 날짜)를 그대로 넘긴다.
        records: result.records,
      });
    }
    return payloads;
  }

  /** 변환 결과를 중앙 저장소(Supabase)에 올린다. 저장은 RPC 한 번의 트랜잭션이다. */
  async function finalizeSave(results: SheetConvertResult[]) {
    try {
      if (!isCentralStoreEnabled) {
        throw new Error('중앙 저장소가 설정되지 않았습니다. 환경변수를 확인해 주세요.');
      }
      const file = fileRef.current;
      if (!file) throw new Error('원본 파일을 찾을 수 없습니다. 파일을 다시 올려주세요.');
      if (!orgIdRef.current) throw new Error('제출 기관(읍면동)을 먼저 선택해주세요.');

      const payloads = buildPayloads(results);
      if (payloads.length === 0) throw new Error('저장할 수 있는 자료가 없습니다.');

      await saveSubmission({
        file,
        fileName: fileNameRef.current,
        organizationId: orgIdRef.current,
        issueCount: results.reduce((sum, r) => sum + r.errors.length, 0),
        sheets: payloads,
      });

      setConvertResults(results);
      setSavedSheetCount(payloads.filter((p) => p.records.length > 0).length);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '자료 저장 중 오류가 발생했습니다.');
      setStep('review');
    }
  }

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/excelWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'parse-done': {
          const parsedSheets = msg.sheets as SheetParseResult[];
          const auto: Record<string, Record<string, PlatformColumnKey | null>> = {};
          for (const sheet of parsedSheets) {
            auto[sheet.sheetName] = autoMapColumns(sheet.columns, sheet.sheetType);
          }
          setSheets(parsedSheets);
          sheetsRef.current = parsedSheets;
          setSheetMappings(auto);
          sheetMappingsRef.current = auto;
          setInitialMappings(auto);
          // 실제 데이터가 있는 첫 업무 시트를 기본으로 고른다. ('안내' 같은 설명 시트는 건너뛴다)
          setActiveSheetName(pickDefaultSheetName(parsedSheets));
          setCheckResults(null);
          setError(null);
          setIsParsing(false);
          setShowPreview(false);
          setShowAllErrors(false);
          setShowAdvanced(false);
          setStep('review');
          break;
        }
        case 'convert-done': {
          const results = msg.sheets as SheetConvertResult[];
          if (convertPurposeRef.current === 'save') {
            void finalizeSave(results); // 중앙 저장 → 브라우저 저장 → 완료 화면
          } else {
            setCheckResults(results);
          }
          break;
        }
        case 'error':
          setError(msg.message as string);
          setIsParsing(false);
          // 이미 읽어둔 파일이 있으면 확인 화면을 유지한다.
          setStep((prev) => (prev === 'review' || prev === 'importing' ? 'review' : 'select'));
          break;
      }
    };

    worker.onerror = (e) => {
      setError(`처리 중 오류가 발생했습니다: ${e.message}`);
      setIsParsing(false);
      setStep((prev) => (prev === 'review' || prev === 'importing' ? 'review' : 'select'));
    };

    workerRef.current = worker;
    return () => worker.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 중앙 저장소가 켜져 있으면 제출 기관(읍면동) 목록을 불러온다.
  useEffect(() => {
    if (!isCentralStoreEnabled) return;
    listOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
        setOrgLoadError(null);
        // 예전에 골라둔 기관이 목록에서 사라졌으면 초기화한다.
        if (orgIdRef.current && !orgs.some((o) => o.id === orgIdRef.current)) {
          setOrgId('');
          localStorage.removeItem(ORG_KEY);
        }
      })
      .catch((err) =>
        setOrgLoadError(err instanceof Error ? err.message : '기관 목록을 불러오지 못했습니다.'),
      );
  }, []);

  function selectOrg(id: string) {
    setOrgId(id);
    if (id) localStorage.setItem(ORG_KEY, id);
  }

  // 저장 전에 값 검증을 한 번 돌려서 "바로 저장 가능 / 오류 수정 필요"를 가른다.
  // 관리자가 직접 연결을 바꾸면 다시 돌린다.
  useEffect(() => {
    if (step !== 'review' || sheets.length === 0) return;
    setCheckResults(null);
    const timer = setTimeout(() => {
      convertPurposeRef.current = 'check';
      workerRef.current?.postMessage({ type: 'convert', sheetMappings: sheetMappingsRef.current });
    }, 150);
    return () => clearTimeout(timer);
  }, [step, sheets, sheetMappings]);

  function processFile(file: File, overrideName?: string) {
    if (!workerRef.current) {
      setError('처리 모듈 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('.xlsx 또는 .xls 파일만 올릴 수 있습니다.');
      return;
    }
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setConvertResults([]);
    setCheckResults(null);
    setSavedSheetCount(0);
    setStep('uploading');
    fileNameRef.current = overrideName ?? file.name;
    fileRef.current = file;

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100);
    };
    reader.onload = (e) => {
      setUploadProgress(100);
      setIsParsing(true);
      const buffer = e.target?.result as ArrayBuffer;
      workerRef.current!.postMessage({ type: 'parse', buffer }, [buffer]);
    };
    reader.onerror = () => {
      setError('파일을 읽는 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setStep('select');
    };
    reader.readAsArrayBuffer(file);
  }

  // 같은 파일 이름을 다시 올리는 것은 "재제출"이다. 중앙 DB가 이전 제출본을
  // superseded 로 내리므로 막지 않는다. (집계에는 최신 제출본만 들어간다)
  function handleFileSelected(file: File) {
    processFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleMappingChange(sheetName: string, col: string, target: PlatformColumnKey | null) {
    setSheetMappings((prev) => ({
      ...prev,
      [sheetName]: { ...prev[sheetName], [col]: target },
    }));
  }

  function handleSave() {
    if (isCentralStoreEnabled && !orgId) {
      setError('제출 기관(읍면동)을 먼저 선택해주세요.');
      return;
    }
    setError(null);
    setConvertResults([]);
    setStep('importing');
    convertPurposeRef.current = 'save';
    workerRef.current?.postMessage({ type: 'convert', sheetMappings });
  }

  function handleReset() {
    fileRef.current = null;
    setSheets([]);
    setActiveSheetName('');
    setSheetMappings({});
    setInitialMappings({});
    setCheckResults(null);
    setConvertResults([]);
    setSavedSheetCount(0);
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setShowPreview(false);
    setShowAllErrors(false);
    setShowAdvanced(false);
    setStep('select');
  }

  // ── 파생 상태 ────────────────────────────────────────────
  const filledSheets = sheets.filter((s) => s.columns.length > 0 && s.totalRows > 0);

  function isRecognized(sheet: SheetParseResult): boolean {
    return checkRecognition(sheet.sheetType, mappedKeysOf(sheet, sheetMappings)).ok;
  }
  const recognizedSheets = filledSheets.filter(isRecognized);

  /**
   * 시트마다 "가져올 열 / 가져오지 않을 열"을 정리한다.
   * 예전에는 연결에 실패한 열을 아무 데도 알리지 않고 그냥 버렸다. 화면은
   * "업로드할 수 있습니다"라고만 했고, 담당자는 자기 자료의 절반이 빠진 걸 알 수 없었다.
   */
  const sheetInsights = useMemo(
    () =>
      filledSheets.map((sheet) => {
        const mapping = sheetMappings[sheet.sheetName] ?? {};
        const mappedKeys = new Set(
          Object.values(mapping).filter((v): v is PlatformColumnKey => v !== null),
        );
        return {
          sheet,
          label: sheetTypeLabel(sheet.sheetType),
          mappedCount: mappedKeys.size,
          dropped: sheet.columns.filter((col) => !mapping[col]),
          recognition: checkRecognition(sheet.sheetType, mappedKeys),
        };
      }),
    // filledSheets는 sheets에서 파생되므로 sheets/sheetMappings만 보면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheets, sheetMappings],
  );

  /** 저장 대상 시트에서 버려지는 열. 하나라도 있으면 화면에 그대로 내건다. */
  const droppedInRecognized = sheetInsights.filter(
    (i) => i.recognition.ok && i.dropped.length > 0,
  );
  const droppedColumnCount = droppedInRecognized.reduce((n, i) => n + i.dropped.length, 0);

  /** 인식하지 못한 시트가 왜 안 됐는지. 화면에 이유를 그대로 보여준다. */
  const unrecognizedReasons = sheetInsights
    .filter((i) => !i.recognition.ok)
    .map((i) => ({
      sheet: i.sheet,
      label: i.label,
      missing: [
        ...i.recognition.missingRequired.map((d) => d.label),
        ...i.recognition.missingCoreGroups.map(
          (g) => `${g.map((d) => d.label).join(' 또는 ')} 중 하나`,
        ),
      ],
    }));

  const skippedSummaryRows = (checkResults ?? []).reduce(
    (sum, r) => sum + (r.skippedSummaryRows ?? 0),
    0,
  );

  // 전체 시트 중복 매핑 검사 (중복이면 저장 차단)
  const hasDuplicateMapping = sheets.some((sheet) => {
    const mapping = sheetMappings[sheet.sheetName] ?? {};
    const seen = new Set<PlatformColumnKey>();
    for (const v of Object.values(mapping)) {
      if (v) {
        if (seen.has(v)) return true;
        seen.add(v);
      }
    }
    return false;
  });

  const errorItems: ErrorItem[] = useMemo(() => {
    const items: ErrorItem[] = [];
    for (const result of checkResults ?? []) {
      const sheet = sheets.find((s) => s.sheetName === result.sheetName);
      const label = sheetTypeLabel(sheet?.sheetType);
      for (const err of result.errors) {
        items.push({
          label,
          cell: err.cellAddress ?? `${err.rowIndex}행`,
          message: err.message,
        });
      }
    }
    return items;
  }, [checkResults, sheets]);

  const isChecking = checkResults === null;
  const reviewState: ReviewState =
    recognizedSheets.length === 0
      ? 'unrecognized'
      : isChecking
        ? 'checking'
        : errorItems.length > 0
          ? 'invalid'
          : 'ready';

  // 안내에 쓰는 건수는 "실제로 가져올 양"이다. 빈 줄은 빼고 센다.
  const readableRows = checkResults
    ? checkResults
        .filter((r) => recognizedSheets.some((s) => s.sheetName === r.sheetName))
        .reduce((sum, r) => sum + r.records.length, 0)
    : recognizedSheets.reduce((sum, s) => sum + s.totalRows, 0);

  const activeSheet =
    sheets.find((s) => s.sheetName === activeSheetName) ?? recognizedSheets[0] ?? sheets[0];
  const activeMapping = sheetMappings[activeSheet?.sheetName ?? ''] ?? {};
  const activeInitialMapping = initialMappings[activeSheet?.sheetName ?? ''] ?? {};
  const activeColumnDefs = getColumnsForType(activeSheet?.sheetType ?? 'generic');

  const savedRecords = convertResults.reduce((sum, r) => sum + r.records.length, 0);
  const savedErrors = convertResults.reduce((sum, r) => sum + r.errors.length, 0);
  const savedSummaryRows = convertResults.reduce(
    (sum, r) => sum + (r.skippedSummaryRows ?? 0),
    0,
  );

  /** 중앙 저장소가 켜져 있으면 제출 기관을 고르기 전에는 저장하지 않는다. */
  const needsOrg = isCentralStoreEnabled && !orgId;
  const canSaveAdvanced =
    !hasDuplicateMapping && !isChecking && recognizedSheets.length > 0 && !needsOrg;

  function renderOrgSelector() {
    if (!isCentralStoreEnabled) return null;
    return (
      <div className="mt-6">
        <label htmlFor="org-select" className="block text-sm font-medium text-slate-700">
          제출 기관(읍면동)
        </label>
        {orgLoadError ? (
          <p className="mt-2 text-sm text-red-600">{orgLoadError}</p>
        ) : (
          <select
            id="org-select"
            value={orgId}
            onChange={(e) => selectOrg(e.target.value)}
            className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">선택해주세요</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.regionName} · {org.name}
              </option>
            ))}
          </select>
        )}
        {needsOrg && !orgLoadError && (
          <p className="mt-2 text-xs text-slate-400">
            어느 읍면동의 자료인지 선택해야 저장할 수 있습니다.
          </p>
        )}
      </div>
    );
  }

  function openMapper(sheetName?: string) {
    if (sheetName) setActiveSheetName(sheetName);
    setShowAdvanced(true);
  }

  /** 어느 열을 가져오고 어느 열을 버리는지. 저장 전에 항상 보이게 한다. */
  function renderMappingSummary() {
    if (recognizedSheets.length === 0) return null;
    const total = sheetInsights
      .filter((i) => i.recognition.ok)
      .reduce((n, i) => n + i.mappedCount, 0);

    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4">
        <p className="text-sm text-slate-700">
          가져올 열 <span className="font-semibold tabular-nums">{total}</span>개
          {droppedColumnCount > 0 && (
            <>
              {' · '}
              가져오지 않을 열{' '}
              <span className="font-semibold tabular-nums text-amber-700">
                {droppedColumnCount}
              </span>
              개
            </>
          )}
        </p>

        {droppedColumnCount > 0 ? (
          <>
            <ul className="mt-3 space-y-1.5">
              {droppedInRecognized.map((item) => (
                <li key={item.sheet.sheetName} className="text-sm text-amber-800">
                  <span className="text-xs text-slate-500">{item.label} · </span>
                  {item.dropped.join(', ')}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              이 열은 저장되지 않습니다. 필요한 열이 섞여 있으면 아래에서 직접 연결해 주세요.
            </p>
            <button
              type="button"
              onClick={() => openMapper(droppedInRecognized[0]?.sheet.sheetName)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              열 연결 고치기
              <ChevronRight size={14} />
            </button>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-500">모든 열을 가져옵니다.</p>
        )}

        {skippedSummaryRows > 0 && (
          <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
            소계·합계로 보이는 {skippedSummaryRows.toLocaleString()}개 행은 두 번 세지 않도록
            가져오지 않습니다.
          </p>
        )}
      </div>
    );
  }

  /** 어느 상태에서든 열 연결을 열 수 있어야 한다. */
  function renderMapperLink() {
    return (
      <div className="mt-8 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => openMapper()}
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          열 연결 직접 고치기
          <ChevronRight size={15} />
        </button>
      </div>
    );
  }

  function renderSheetPicker(list: SheetParseResult[]) {
    if (list.length < 2) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {list.map((sheet) => (
          <button
            key={sheet.sheetName}
            type="button"
            onClick={() => setActiveSheetName(sheet.sheetName)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeSheet?.sheetName === sheet.sheetName
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className="max-w-[180px] truncate">{sheetTypeLabel(sheet.sheetType)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <div className="mb-4">
        <Link
          to="/files"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
        >
          <ArrowLeft size={16} /> 자료 관리
        </Link>
      </div>

      <PageHeader
        title="자료 올리기"
        description={
          step === 'select'
            ? '표준 양식으로 작성한 Excel 파일을 올려주세요. 올린 자료는 통합 현황에 자동으로 반영됩니다.'
            : undefined
        }
      />

      {/* ── 파일 선택 ── */}
      {step === 'select' && (
        <section className="rounded-2xl border border-slate-200 bg-white px-8 py-8">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInputChange}
          />

          <div
            role="button"
            tabIndex={0}
            aria-label="Excel 파일 선택"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-14 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isDragging
                ? 'border-teal-400 bg-teal-50'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            <FolderOpen size={40} className="text-teal-500" />
            <div>
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700">
                <Upload size={14} className="text-slate-400" />
                Excel 파일을 여기에 놓기 또는 파일 선택
              </p>
              <p className="mt-1 text-xs text-slate-400">.xlsx, .xls 파일</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </section>
      )}

      {/* ── 파일 읽는 중 ── */}
      {step === 'uploading' && (
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
          {!isParsing ? (
            <>
              <p className="text-sm font-medium text-slate-800">파일을 읽고 있어요</p>
              <div className="w-full max-w-sm">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
              <div>
                <p className="text-sm font-medium text-slate-800">내용을 확인하고 있어요</p>
                <p className="mt-1 text-xs text-slate-400">
                  자료가 많으면 조금 오래 걸릴 수 있습니다.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 확인 ── */}
      {step === 'review' && sheets.length > 0 && (
        <>
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* A. 정상 — 지금 필요한 것 하나만 */}
          {reviewState === 'ready' && !showAdvanced && (
            <section className="rounded-2xl border border-slate-200 bg-white px-9 py-9">
              <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                자료를 확인했어요
              </h2>

              <p className="mt-5 text-sm font-medium text-slate-800">{fileNameRef.current}</p>
              <p className="mt-1 text-sm text-slate-500">
                {recognizedSheets.length}개 자료 · {readableRows.toLocaleString()}건
              </p>

              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600">
                <Check size={16} strokeWidth={3} />
                업로드할 수 있습니다
              </p>

              {renderMappingSummary()}

              {renderOrgSelector()}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={needsOrg}
                  className="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  자료 저장
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  다른 파일 선택
                </button>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  aria-expanded={showPreview}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  내용 미리보기
                  <ChevronRight
                    size={15}
                    className={`transition-transform ${showPreview ? 'rotate-90' : ''}`}
                  />
                </button>

                {showPreview && (
                  <div className="mt-5">
                    <ExcelPreview
                      key={fileNameRef.current}
                      sheets={sheets}
                      fileName={fileNameRef.current}
                      mappings={sheetMappings}
                      workerRef={workerRef}
                    />
                  </div>
                )}
              </div>

              {renderMapperLink()}
            </section>
          )}

          {/* 검증 중 — 상태가 정해지기 전에는 아무것도 단정하지 않는다 */}
          {reviewState === 'checking' && !showAdvanced && (
            <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
              <p className="text-sm font-medium text-slate-800">내용을 확인하고 있어요</p>
            </section>
          )}

          {/* B. 데이터 오류 — 사용자가 할 일은 파일 수정뿐 */}
          {reviewState === 'invalid' && !showAdvanced && (
            <section className="rounded-2xl border border-slate-200 bg-white px-9 py-9">
              <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                {errorItems.length.toLocaleString()}곳을 확인해주세요
              </h2>
              <p className="mt-2 text-sm text-slate-500">{fileNameRef.current}</p>

              <ul className="mt-7 space-y-5">
                {(showAllErrors ? errorItems.slice(0, MAX_LISTED_ERRORS) : errorItems.slice(0, COLLAPSED_ERRORS)).map(
                  (item, i) => (
                    <li key={i}>
                      <p className="text-xs font-medium tabular-nums text-slate-400">
                        {item.label} · {item.cell}
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{item.message}</p>
                    </li>
                  ),
                )}
              </ul>

              {showAllErrors && errorItems.length > MAX_LISTED_ERRORS && (
                <p className="mt-5 text-xs text-slate-400">
                  외 {(errorItems.length - MAX_LISTED_ERRORS).toLocaleString()}건 더 있습니다.
                </p>
              )}

              {errorItems.length > COLLAPSED_ERRORS && (
                <button
                  type="button"
                  onClick={() => setShowAllErrors((v) => !v)}
                  aria-expanded={showAllErrors}
                  className="mt-5 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  {showAllErrors ? '접기' : `오류 ${errorItems.length.toLocaleString()}개 모두 보기`}
                  <ChevronRight
                    size={15}
                    className={`transition-transform ${showAllErrors ? 'rotate-90' : ''}`}
                  />
                </button>
              )}

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  수정한 파일 다시 올리기
                </button>
              </div>

              {renderMapperLink()}
            </section>
          )}

          {/* C. 양식 인식 실패 — 무엇이 모자라서 못 읽었는지까지 알려준다 */}
          {reviewState === 'unrecognized' && !showAdvanced && (
            <section className="rounded-2xl border border-slate-200 bg-white px-9 py-9">
              <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                이 파일의 양식을 확인할 수 없습니다
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
                꼭 필요한 열을 찾지 못했습니다. 아래 항목에 해당하는 열이 파일에 있는지 확인하거나,
                열 연결을 직접 지정해 주세요.
              </p>
              <p className="mt-5 text-sm text-slate-400">{fileNameRef.current}</p>

              {unrecognizedReasons.length > 0 && (
                <ul className="mt-6 space-y-4">
                  {unrecognizedReasons.map((item) => (
                    <li key={item.sheet.sheetName}>
                      <p className="text-xs font-medium text-slate-400">
                        {item.sheet.sheetName} · {item.label} · {item.sheet.headerRowIndex}행을
                        머리글로 읽음
                      </p>
                      {item.missing.length > 0 ? (
                        <p className="mt-1 text-sm text-slate-800">
                          찾지 못한 항목: {item.missing.join(', ')}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-800">
                          알아볼 수 있는 열이 없습니다.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => openMapper()}
                  className="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  열 연결 직접 고치기
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  다른 파일 선택
                </button>
              </div>
            </section>
          )}

          {/* 열 연결 직접 고치기 — 어느 상태에서든 열 수 있다 */}
          {showAdvanced && (
            <section className="rounded-2xl border border-slate-200 bg-white px-9 py-9">
              <h2 className="text-lg font-semibold text-slate-900">열 연결 직접 고치기</h2>
              <p className="mt-2 text-sm text-slate-500">
                엑셀 열을 플랫폼 항목에 직접 연결합니다. * 표시는 꼭 필요한 항목입니다.
                '사용 안 함'으로 둔 열은 저장되지 않습니다.
              </p>

              <div className="mt-6">
                {renderSheetPicker(sheets)}
                {activeSheet && (
                  <div className={sheets.length > 1 ? 'pt-4' : ''}>
                    {activeSheet.columns.length === 0 ? (
                      <p className="text-sm text-slate-400">연결할 항목이 없습니다.</p>
                    ) : (
                      <ColumnMapper
                        excelColumns={activeSheet.columns}
                        mappings={activeMapping}
                        initialMappings={activeInitialMapping}
                        columnDefs={activeColumnDefs}
                        onChange={(col, target) =>
                          handleMappingChange(activeSheet.sheetName, col, target)
                        }
                      />
                    )}
                  </div>
                )}
              </div>

              {hasDuplicateMapping && (
                <p className="mt-5 text-sm text-amber-700">
                  같은 항목이 두 열에 연결되어 있습니다. 하나만 남겨주세요.
                </p>
              )}
              {!hasDuplicateMapping && !isChecking && errorItems.length > 0 && (
                <p className="mt-5 text-sm text-amber-700">
                  값을 인식하지 못한 칸이 {errorItems.length.toLocaleString()}건 있습니다. 저장하면
                  해당 칸은 비워 둡니다.
                </p>
              )}

              {renderOrgSelector()}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSaveAdvanced}
                  className="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  자료 저장
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(false)}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  확인 화면으로
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  다른 파일 선택
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── 저장 중 ── */}
      {step === 'importing' && (
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
          <p className="text-sm font-medium text-slate-800">자료를 저장하고 있어요</p>
        </section>
      )}

      {/* ── 완료 ── */}
      {step === 'done' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-9 py-9">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
                <Check size={20} className="text-teal-600" strokeWidth={2.5} />
              </span>
              <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
                자료를 저장했어요
              </h2>
            </div>

            <p className="mt-5 text-sm text-slate-600">
              {savedSheetCount}개 자료 · {savedRecords.toLocaleString()}건
            </p>
            <p className="mt-1 text-sm text-slate-500">통합 현황에 반영되었습니다.</p>
            {savedSummaryRows > 0 && (
              <p className="mt-1 text-sm text-slate-400">
                소계·합계 행 {savedSummaryRows.toLocaleString()}개는 이중 계산을 막기 위해
                제외했습니다.
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/files"
                className="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                자료 관리로 돌아가기
              </Link>
              <Link
                to="/"
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                통합 대시보드 보기
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-700"
              >
                <RotateCcw size={14} /> 다른 자료 올리기
              </button>
            </div>
          </section>

          {/* 관리자 직접 연결로 저장한 경우에만 남는 값 오류. 기본은 접혀 있다. */}
          {savedErrors > 0 && (
            <details className="group mt-4 rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-9 py-5 text-sm font-medium text-slate-600">
                값을 인식하지 못한 칸 {savedErrors.toLocaleString()}건 보기
                <ChevronDown
                  size={16}
                  className="text-slate-400 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="max-h-80 overflow-auto border-t border-slate-100 px-9 py-5">
                <ul className="space-y-4">
                  {convertResults
                    .flatMap((result) => {
                      const sheet = sheets.find((s) => s.sheetName === result.sheetName);
                      return result.errors.map((err) => ({
                        label: sheetTypeLabel(sheet?.sheetType),
                        cell: err.cellAddress ?? `${err.rowIndex}행`,
                        field: ALL_FIELD_LABELS[err.field] ?? err.field,
                        message: err.message,
                      }));
                    })
                    .slice(0, MAX_LISTED_ERRORS)
                    .map((item, i) => (
                      <li key={i}>
                        <p className="text-xs font-medium tabular-nums text-slate-400">
                          {item.label} · {item.cell} · {item.field}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                      </li>
                    ))}
                </ul>
                {savedErrors > MAX_LISTED_ERRORS && (
                  <p className="mt-4 text-xs text-slate-400">
                    외 {(savedErrors - MAX_LISTED_ERRORS).toLocaleString()}건 더 있습니다.
                  </p>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
