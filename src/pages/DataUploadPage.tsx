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
  TriangleAlert,
  Upload,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import ColumnMapper from '../components/upload/ColumnMapper';
import ConversionPreview from '../components/upload/ConversionPreview';
import ExcelPreview, { pickDefaultSheetName } from '../components/upload/ExcelPreview';
import { fieldLabel, getColumnsForType } from '../utils/excel/schema';
import { defaultMapping } from '../utils/excel/engine';
import {
  findSameOrganizationConflicts,
  sheetTypeLabel,
  suggestUniqueFileName,
} from '../utils/submission';
import { isCentralStoreEnabled } from '../lib/supabase';
import {
  listOrganizations,
  listRegisteredFileNames,
  saveSubmission,
  type Organization,
  type RegisteredFileName,
  type SheetPayload,
} from '../store/remote';
import type {
  PlatformColumnKey,
  SheetConvertResult,
  SheetParseResult,
} from '../types/upload';

/** 오류가 많아도 기본 화면에는 몇 개만. 나머지는 "모두 보기"로. */
const COLLAPSED_ERRORS = 3;
const MAX_LISTED_ERRORS = 50;

type Step = 'select' | 'uploading' | 'review' | 'importing' | 'done';

interface ErrorItem {
  label: string;
  cell: string;
  message: string;
}

/** 마지막으로 선택한 제출 기관. 다음 업로드 때 기본값으로 쓴다. */
const ORG_KEY = 'jd-org-id';

type Mappings = Record<string, Record<string, PlatformColumnKey | null>>;

export default function DataUploadPage() {
  const [step, setStep] = useState<Step>('select');
  const [sheets, setSheets] = useState<SheetParseResult[]>([]);
  const [activeSheetName, setActiveSheetName] = useState('');
  const [sheetMappings, setSheetMappings] = useState<Mappings>({});
  /** 저장 전 검증 결과. null이면 아직 확인 중. */
  const [checkResults, setCheckResults] = useState<SheetConvertResult[] | null>(null);
  const [convertResults, setConvertResults] = useState<SheetConvertResult[]>([]);
  const [savedSheetCount, setSavedSheetCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  /** 확인이 필요한 자료를 사용자가 보고 넘어가겠다고 밝힌 상태. */
  const [acknowledged, setAcknowledged] = useState(false);
  /** 중앙 저장소용 제출 기관(읍면동). 파일명에서 추론하지 않고 명시적으로 고른다. */
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  /** 이미 올라온 자료의 파일 이름. 이름 겹침을 저장 전에 잡기 위해서만 쓴다. */
  const [registeredNames, setRegisteredNames] = useState<RegisteredFileName[]>([]);
  /** 저장될 파일 이름. 겹치면 사용자가 여기서 고친다. */
  const [fileName, setFileName] = useState('');
  /**
   * 같은 동에 같은 이름이 이미 있을 때 사용자가 고른 처리.
   *  ask       아직 안 골랐다 — 저장하지 않는다
   *  overwrite 덮어쓴다 (DB가 이전 자료를 대체한다)
   *  rename    이름을 바꿔서 따로 올린다
   */
  const [nameChoice, setNameChoice] = useState<'ask' | 'overwrite' | 'rename'>('ask');
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_KEY) ?? '');
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileNameRef = useRef('');
  fileNameRef.current = fileName;
  /** Storage 업로드용 원본 파일. (worker에는 버퍼가 transfer되어 넘어간다) */
  const fileRef = useRef<File | null>(null);

  // 워커 콜백은 한 번만 만들어지므로, 저장에 필요한 최신 값을 ref로 들고 있는다.
  const sheetsRef = useRef<SheetParseResult[]>([]);
  sheetsRef.current = sheets;
  const sheetMappingsRef = useRef<Mappings>(sheetMappings);
  sheetMappingsRef.current = sheetMappings;
  /** 같은 convert-done 메시지를 검증용/저장용으로 나눠 받는다. */
  const convertPurposeRef = useRef<'check' | 'save'>('check');
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  /** 필수 항목이 모두 연결된(=우리가 읽을 수 있는) 시트인지. */
  function isSheetRecognized(sheet: SheetParseResult, mappings: Mappings): boolean {
    if (sheet.role === 'guide' || sheet.columns.length === 0) return false;
    const mapping = mappings[sheet.sheetName] ?? {};
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    if (mapped.size === 0) return false;
    return getColumnsForType(sheet.sheetType).every((d) => !d.required || mapped.has(d.key));
  }

  /** 저장 대상 시트만 골라 중앙 저장소가 받을 모양으로 만든다. */
  function buildPayloads(results: SheetConvertResult[]): SheetPayload[] {
    const payloads: SheetPayload[] = [];
    for (const result of results) {
      const sheet = sheetsRef.current.find((s) => s.sheetName === result.sheetName);
      if (!sheet || !isSheetRecognized(sheet, sheetMappingsRef.current)) continue;
      payloads.push({
        sheetName: result.sheetName,
        sheetType: sheet.sheetType,
        errorCount: result.errors.length,
        // 시트 이름뿐 아니라 내용까지 보고 판정한 값. DB의 is_cumulative 와 같은 뜻이다.
        isCumulative: sheet.isCumulative,
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
          const auto: Mappings = {};
          for (const sheet of parsedSheets) auto[sheet.sheetName] = defaultMapping(sheet);
          setSheets(parsedSheets);
          sheetsRef.current = parsedSheets;
          setSheetMappings(auto);
          sheetMappingsRef.current = auto;
          // 실제 데이터가 있는 첫 업무 시트를 기본으로 고른다. ('안내' 같은 설명 시트는 건너뛴다)
          setActiveSheetName(pickDefaultSheetName(parsedSheets));
          setCheckResults(null);
          setError(null);
          setIsParsing(false);
          setShowPreview(false);
          setShowMapper(false);
          setShowAllErrors(false);
          setAcknowledged(false);
          setStep('review');
          break;
        }
        case 'convert-done': {
          const results = msg.sheets as SheetConvertResult[];
          if (convertPurposeRef.current === 'save') {
            void finalizeSave(results);
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
        if (orgIdRef.current && !orgs.some((o) => o.id === orgIdRef.current)) {
          setOrgId('');
          localStorage.removeItem(ORG_KEY);
        }
      })
      .catch((err) =>
        setOrgLoadError(err instanceof Error ? err.message : '기관 목록을 불러오지 못했습니다.'),
      );
  }, []);

  // 이름 겹침을 확인하려면 이미 올라온 자료의 이름이 필요하다.
  useEffect(() => {
    if (!isCentralStoreEnabled) return;
    listRegisteredFileNames()
      .then(setRegisteredNames)
      // 이름 확인은 보조 기능이다. 못 불러왔다고 업로드 자체를 막지는 않는다.
      .catch(() => setRegisteredNames([]));
  }, []);

  function selectOrg(id: string) {
    setOrgId(id);
    if (id) localStorage.setItem(ORG_KEY, id);
  }

  // 연결이 바뀌면 변환 결과를 다시 만든다. 화면의 "저장될 내용"은 늘 지금 연결을 반영한다.
  useEffect(() => {
    if (step !== 'review' || sheets.length === 0) return;
    setCheckResults(null);
    const timer = setTimeout(() => {
      convertPurposeRef.current = 'check';
      workerRef.current?.postMessage({ type: 'convert', sheetMappings: sheetMappingsRef.current });
    }, 150);
    return () => clearTimeout(timer);
  }, [step, sheets, sheetMappings]);

  function processFile(file: File) {
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
    setFileName(file.name);
    fileNameRef.current = file.name;
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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleMappingChange(sheetName: string, col: string, target: PlatformColumnKey | null) {
    // 연결을 바꾸면 저장될 내용도 달라진다. 다시 확인받는다.
    setAcknowledged(false);
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
    if (!fileName.trim()) {
      setError('저장할 파일 이름을 입력해주세요.');
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
    setFileName('');
    setSheets([]);
    setActiveSheetName('');
    setSheetMappings({});
    setCheckResults(null);
    setConvertResults([]);
    setSavedSheetCount(0);
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setShowPreview(false);
    setShowMapper(false);
    setShowAllErrors(false);
    setAcknowledged(false);
    setStep('select');
  }

  // ── 파생 상태 ────────────────────────────────────────────
  /** 업무 시트. 안내 시트와 표가 없는 시트는 뺀다. */
  const dataSheets = useMemo(
    () => sheets.filter((s) => s.role !== 'guide' && s.columns.length > 0),
    [sheets],
  );

  const recognizedSheets = dataSheets.filter((s) => isSheetRecognized(s, sheetMappings));

  /** 전체 시트 중복 매핑 검사 (중복이면 저장 차단) */
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

  /**
   * 사용자가 확인해야 할 것들.
   * 하나라도 있으면 "업로드할 수 있습니다"라고 말하지 않는다.
   */
  const attention = useMemo(() => {
    const unmappedColumns: Array<{ sheetName: string; name: string; letter: string; reason: string }> = [];
    const suggestedColumns: Array<{ sheetName: string; name: string }> = [];
    const unknownSheets: string[] = [];

    for (const sheet of dataSheets) {
      const mapping = sheetMappings[sheet.sheetName] ?? {};
      if (sheet.role === 'unknown') unknownSheets.push(sheet.sheetName);
      for (const diag of sheet.columnDiagnostics) {
        const current = mapping[diag.name] ?? null;
        if (!current && diag.status !== 'ignored') {
          unmappedColumns.push({
            sheetName: sheet.sheetName,
            name: diag.name,
            letter: diag.letter,
            reason: diag.reason,
          });
        } else if (current && diag.status === 'suggested' && current === diag.mapped) {
          suggestedColumns.push({ sheetName: sheet.sheetName, name: diag.name });
        }
      }
    }

    const skippedRows = (checkResults ?? []).flatMap((r) =>
      r.skippedRows
        .filter((row) => row.kind === 'uncertain')
        .map((row) => ({ sheetName: r.sheetName, ...row })),
    );

    // 파일이 스스로 적어둔 합계와 우리가 읽은 값의 합이 다르면 어딘가를 잘못 읽은 것이다.
    const totalsMismatches = (checkResults ?? []).flatMap((r) =>
      r.totalsChecks.filter((c) => !c.matches).map((c) => ({ sheetName: r.sheetName, ...c })),
    );

    return { unmappedColumns, suggestedColumns, unknownSheets, skippedRows, totalsMismatches };
  }, [dataSheets, sheetMappings, checkResults]);

  const errorItems: ErrorItem[] = useMemo(() => {
    const items: ErrorItem[] = [];
    for (const result of checkResults ?? []) {
      const sheet = sheets.find((s) => s.sheetName === result.sheetName);
      if (!sheet || !isSheetRecognized(sheet, sheetMappings)) continue;
      const label = sheetTypeLabel(sheet.sheetType);
      for (const err of result.errors) {
        items.push({ label, cell: err.cellAddress ?? `${err.rowIndex}행`, message: err.message });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkResults, sheets, sheetMappings]);

  const isChecking = checkResults === null;
  const attentionCount =
    attention.unmappedColumns.length +
    attention.suggestedColumns.length +
    attention.unknownSheets.length +
    attention.skippedRows.length +
    attention.totalsMismatches.length;
  const needsConfirm = attentionCount > 0 || errorItems.length > 0;
  const canRead = recognizedSheets.length > 0;

  // 안내에 쓰는 건수는 "실제로 가져올 양"이다. 빈 줄·집계 행은 빼고 센다.
  const readableRows = (checkResults ?? [])
    .filter((r) => recognizedSheets.some((s) => s.sheetName === r.sheetName))
    .reduce((sum, r) => sum + r.records.length, 0);

  const activeSheet =
    dataSheets.find((s) => s.sheetName === activeSheetName) ?? recognizedSheets[0] ?? dataSheets[0];
  const activeMapping = sheetMappings[activeSheet?.sheetName ?? ''] ?? {};
  const activeResult = (checkResults ?? []).find((r) => r.sheetName === activeSheet?.sheetName);

  const savedRecords = convertResults.reduce((sum, r) => sum + r.records.length, 0);
  const savedErrors = convertResults.reduce((sum, r) => sum + r.errors.length, 0);

  /** 중앙 저장소가 켜져 있으면 제출 기관을 고르기 전에는 저장하지 않는다. */
  const needsOrg = isCentralStoreEnabled && !orgId;

  // ── 파일 이름 겹침 ────────────────────────────────────────
  // 다른 동끼리 이름이 겹치는 것은 막지 않는다. 목록에 기관명이 함께 나오기 때문이다.
  // 같은 동 안에서 겹치면 DB가 이전 자료를 대체한다. 덮어쓸 생각이 아니었다면 예전
  // 자료가 말없이 사라지므로, 저장 전에 어느 쪽인지 물어본다.
  const currentOrgName = organizations.find((o) => o.id === orgId)?.name;
  const sameOrgConflicts = useMemo(
    () => findSameOrganizationConflicts(registeredNames, fileName, orgId),
    [registeredNames, fileName, orgId],
  );
  const hasNameConflict = sameOrgConflicts.length > 0;
  /** 겹치는데 아직 어떻게 할지 안 골랐으면 저장하지 않는다. */
  const needsNameDecision = hasNameConflict && nameChoice !== 'overwrite';

  // 이름이나 기관이 바뀌면 앞서 고른 처리는 무효다. 다시 물어본다.
  useEffect(() => {
    setNameChoice('ask');
  }, [fileName, orgId]);

  function applySuggestedName() {
    // 같은 동 안에서만 안 겹치면 된다. 다른 동 이름까지 피할 이유가 없다.
    const takenInOrg = registeredNames
      .filter((r) => r.organizationId === orgId)
      .map((r) => r.fileName);
    setFileName(suggestUniqueFileName(fileName, takenInOrg, currentOrgName));
  }
  const canSave =
    canRead && !hasDuplicateMapping && !isChecking && !needsOrg && !needsNameDecision &&
    fileName.trim() !== '' && (!needsConfirm || acknowledged);

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

  function renderSheetPicker() {
    if (dataSheets.length < 2) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {dataSheets.map((sheet) => (
          <button
            key={sheet.sheetName}
            type="button"
            onClick={() => setActiveSheetName(sheet.sheetName)}
            aria-pressed={activeSheet?.sheetName === sheet.sheetName}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeSheet?.sheetName === sheet.sheetName
                ? 'bg-slate-800 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span className="max-w-[200px] truncate align-middle">{sheet.sheetName}</span>
            <span
              className={`ml-1.5 ${
                activeSheet?.sheetName === sheet.sheetName ? 'text-white/60' : 'text-slate-400'
              }`}
            >
              {sheetTypeLabel(sheet.sheetType)}
            </span>
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
          <ArrowLeft size={16} /> 자료·데이터 관리
        </Link>
      </div>

      <PageHeader
        title="자료 올리기"
        description={
          step === 'select'
            ? 'Excel 파일을 올리면 표 위치와 열 뜻을 자동으로 찾아 읽습니다. 저장 전에 무엇이 어떻게 저장될지 확인할 수 있습니다.'
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
                <p className="mt-1 text-xs text-slate-400">자료가 많으면 조금 오래 걸릴 수 있습니다.</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 확인 ── */}
      {step === 'review' && sheets.length > 0 && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 요약 */}
          <section className="rounded-2xl border border-slate-200 bg-white px-9 py-8">
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
              {!canRead
                ? '이 파일의 양식을 확인할 수 없습니다'
                : isChecking
                  ? '내용을 확인하고 있어요'
                  : needsConfirm
                    ? '저장 전에 확인해 주세요'
                    : '자료를 확인했어요'}
            </h2>

            <p className="mt-5 text-sm font-medium text-slate-800">{fileName}</p>
            <p className="mt-1 text-sm text-slate-500">
              {canRead
                ? `${recognizedSheets.length}개 자료 · ${readableRows.toLocaleString()}건`
                : '표준 항목과 맞는 열을 찾지 못했습니다. 아래에서 직접 연결해 주세요.'}
            </p>

            {canRead && !isChecking && !needsConfirm && (
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-600">
                <Check size={16} strokeWidth={3} /> 업로드할 수 있습니다
              </p>
            )}
            {canRead && !isChecking && needsConfirm && (
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-amber-700">
                <TriangleAlert size={16} /> 확인할 항목 {attentionCount + errorItems.length}건이 있습니다
              </p>
            )}

            {/* 시트별 안내 (누계 제외, 병합 머리글 등) */}
            {dataSheets.some((s) => s.notes.length > 0) && (
              <ul className="mt-5 space-y-1.5">
                {dataSheets.flatMap((sheet) =>
                  sheet.notes.map((note, i) => (
                    <li key={`${sheet.sheetName}-${i}`} className="text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{sheet.sheetName}</span> · {note}
                    </li>
                  )),
                )}
              </ul>
            )}
          </section>

          {/* 확인이 필요한 것들 */}
          {!isChecking && needsConfirm && (
            <section className="rounded-2xl border border-amber-200 bg-white px-9 py-8">
              <h3 className="text-base font-semibold text-slate-900">확인이 필요한 항목</h3>

              {attention.unknownSheets.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">자료 종류를 확정하지 못한 시트</p>
                  <p className="mt-1 text-sm text-slate-500">{attention.unknownSheets.join(', ')}</p>
                </div>
              )}

              {attention.unmappedColumns.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">
                    연결되지 않은 열 {attention.unmappedColumns.length}개 — 이 열의 값은 저장되지 않습니다
                  </p>
                  <ul className="mt-2 space-y-1">
                    {attention.unmappedColumns.map((col) => (
                      <li key={`${col.sheetName}-${col.name}`} className="text-sm text-slate-600">
                        <span className="font-medium text-slate-800">{col.name}</span>
                        <span className="text-slate-400">
                          {' '}
                          ({col.sheetName} · {col.letter}열) — {col.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {attention.suggestedColumns.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">
                    비슷해 보여 연결한 열 {attention.suggestedColumns.length}개 — 맞는지 확인해 주세요
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {attention.suggestedColumns.map((c) => c.name).join(', ')}
                  </p>
                </div>
              )}

              {attention.totalsMismatches.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">
                    파일에 적힌 합계와 읽은 값의 합이 다릅니다
                  </p>
                  <ul className="mt-2 space-y-1">
                    {attention.totalsMismatches.map((check) => (
                      <li
                        key={`${check.sheetName}-${check.field}`}
                        className="text-sm text-slate-600"
                      >
                        <span className="tabular-nums text-slate-400">
                          {check.sheetName} · {check.rowNumber}행
                        </span>{' '}
                        — {fieldLabel(check.field)}: 파일의 합계{' '}
                        <span className="font-medium">{check.declared.toLocaleString()}</span> vs 읽은
                        값의 합 <span className="font-medium">{check.computed.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-400">
                    빠뜨린 줄이 있거나 열이 잘못 연결되었을 수 있습니다. 열 연결과 저장될 내용을
                    확인해 주세요.
                  </p>
                </div>
              )}

              {attention.skippedRows.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">
                    데이터 행인지 판단하기 어려워 제외한 행 {attention.skippedRows.length}개
                  </p>
                  <ul className="mt-2 space-y-1">
                    {attention.skippedRows.slice(0, COLLAPSED_ERRORS).map((row) => (
                      <li key={`${row.sheetName}-${row.rowNumber}`} className="text-sm text-slate-600">
                        <span className="tabular-nums text-slate-400">
                          {row.sheetName} · {row.rowNumber}행
                        </span>{' '}
                        — {row.message}
                      </li>
                    ))}
                  </ul>
                  {attention.skippedRows.length > COLLAPSED_ERRORS && (
                    <p className="mt-1 text-xs text-slate-400">
                      외 {attention.skippedRows.length - COLLAPSED_ERRORS}건 더 있습니다.
                    </p>
                  )}
                </div>
              )}

              {errorItems.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">
                    값을 읽지 못한 칸 {errorItems.length.toLocaleString()}곳 — 저장하면 해당 칸은 비워
                    둡니다
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(showAllErrors
                      ? errorItems.slice(0, MAX_LISTED_ERRORS)
                      : errorItems.slice(0, COLLAPSED_ERRORS)
                    ).map((item, i) => (
                      <li key={i} className="text-sm text-slate-600">
                        <span className="tabular-nums text-slate-400">
                          {item.label} · {item.cell}
                        </span>{' '}
                        — {item.message}
                      </li>
                    ))}
                  </ul>
                  {errorItems.length > COLLAPSED_ERRORS && (
                    <button
                      type="button"
                      onClick={() => setShowAllErrors((v) => !v)}
                      aria-expanded={showAllErrors}
                      className="mt-2 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {showAllErrors ? '접기' : `${errorItems.length.toLocaleString()}곳 모두 보기`}
                      <ChevronRight
                        size={15}
                        className={`transition-transform ${showAllErrors ? 'rotate-90' : ''}`}
                      />
                    </button>
                  )}
                  {showAllErrors && errorItems.length > MAX_LISTED_ERRORS && (
                    <p className="mt-2 text-xs text-slate-400">
                      외 {(errorItems.length - MAX_LISTED_ERRORS).toLocaleString()}건 더 있습니다.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 저장될 내용 — 늘 펼쳐 둔다 */}
          {activeSheet && (
            <section className="rounded-2xl border border-slate-200 bg-white px-9 py-8">
              <h3 className="text-base font-semibold text-slate-900">저장될 내용</h3>
              <p className="mt-1 text-sm text-slate-500">
                아래 내용이 그대로 통합 현황에 반영됩니다. 다르면 열 연결을 고쳐 주세요.
              </p>

              <div className="mt-5 space-y-5">
                {renderSheetPicker()}
                {isChecking ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
                  </div>
                ) : (
                  <ConversionPreview
                    sheet={activeSheet}
                    result={activeResult}
                    mappings={activeMapping}
                  />
                )}
              </div>

              {/* 열 연결 — 인식이 잘 됐을 때도 언제나 열 수 있다 */}
              <div className="mt-8 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowMapper((v) => !v)}
                  aria-expanded={showMapper}
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  열 연결 확인·수정
                  <ChevronRight
                    size={15}
                    className={`transition-transform ${showMapper ? 'rotate-90' : ''}`}
                  />
                </button>

                {showMapper && (
                  <div className="mt-5">
                    {activeSheet.columnDiagnostics.length === 0 ? (
                      <p className="text-sm text-slate-400">연결할 열이 없습니다.</p>
                    ) : (
                      <ColumnMapper
                        diagnostics={activeSheet.columnDiagnostics}
                        mappings={activeMapping}
                        columnDefs={getColumnsForType(activeSheet.sheetType)}
                        onChange={(col, target) =>
                          handleMappingChange(activeSheet.sheetName, col, target)
                        }
                      />
                    )}
                    {hasDuplicateMapping && (
                      <p className="mt-4 text-sm text-amber-700">
                        같은 항목이 두 열에 연결되어 있습니다. 하나만 남겨주세요.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 원본 미리보기 */}
              <div className="mt-5 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  aria-expanded={showPreview}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  원본 엑셀 미리보기
                  <ChevronRight
                    size={15}
                    className={`transition-transform ${showPreview ? 'rotate-90' : ''}`}
                  />
                </button>

                {showPreview && (
                  <div className="mt-5">
                    <ExcelPreview
                      key={fileName}
                      sheets={sheets}
                      fileName={fileName}
                      mappings={sheetMappings}
                      workerRef={workerRef}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 저장 */}
          <section className="rounded-2xl border border-slate-200 bg-white px-9 py-8">
            {renderOrgSelector()}

            {/* 파일 이름 — 같은 동에 같은 이름이 있으면 어떻게 할지 먼저 정한다 */}
            {isCentralStoreEnabled && (
              <div className="mt-6">
                <label htmlFor="file-name" className="block text-sm font-medium text-slate-700">
                  저장할 파일 이름
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    id="file-name"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    aria-invalid={needsNameDecision}
                    className={`w-full max-w-md rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      needsNameDecision
                        ? 'border-amber-300 text-amber-900 focus:ring-amber-400'
                        : 'border-slate-200 text-slate-700 focus:ring-teal-500'
                    }`}
                  />
                  {nameChoice === 'rename' && hasNameConflict && (
                    <button
                      type="button"
                      onClick={applySuggestedName}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      겹치지 않는 이름 제안
                    </button>
                  )}
                </div>

                {hasNameConflict ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-medium text-amber-900">
                      {currentOrgName ?? '이 기관'}에 같은 이름의 자료가 이미 있습니다
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {sameOrgConflicts.map((match, i) => (
                        <li key={i} className="text-sm text-amber-800">
                          {match.fileName}
                        </li>
                      ))}
                    </ul>

                    {nameChoice === 'ask' && (
                      <>
                        <p className="mt-2 text-xs text-amber-800">
                          덮어쓰면 이전 자료는 통합 현황 집계에서 빠집니다. 둘 다 남기려면 이름을
                          바꿔주세요.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setNameChoice('overwrite')}
                            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                          >
                            덮어쓰기
                          </button>
                          <button
                            type="button"
                            onClick={() => setNameChoice('rename')}
                            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            이름 바꿔서 올리기
                          </button>
                        </div>
                      </>
                    )}

                    {nameChoice === 'rename' && (
                      <p className="mt-2 text-sm text-amber-800">
                        위 칸에서 이름을 바꿔주세요. 같은 이름이 없어지면 저장할 수 있습니다.
                      </p>
                    )}
                  </div>
                ) : nameChoice === 'overwrite' ? (
                  <p className="mt-2 text-sm text-amber-700">
                    덮어쓰기로 저장합니다. 이전 자료는 집계에서 빠집니다.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    이 이름으로 자료·데이터 관리 목록에 표시됩니다. 원본 파일은 그대로 보관됩니다.
                  </p>
                )}
              </div>
            )}

            {needsConfirm && !isChecking && canRead && (
              <label className="mt-6 flex items-start gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>
                  위 "확인이 필요한 항목"과 "저장될 내용"을 확인했습니다. 이대로 저장합니다.
                </span>
              </label>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
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

            {!canRead && (
              <p className="mt-4 text-sm text-slate-500">
                꼭 필요한 항목이 연결되지 않아 아직 저장할 수 없습니다. "열 연결 확인·수정"에서
                지정해 주세요.
              </p>
            )}
          </section>
        </div>
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

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/files"
                className="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                자료·데이터 관리로 돌아가기
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

          {savedErrors > 0 && (
            <details className="group mt-4 rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-9 py-5 text-sm font-medium text-slate-600">
                값을 읽지 못한 칸 {savedErrors.toLocaleString()}건 보기
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
                        message: err.message,
                      }));
                    })
                    .slice(0, MAX_LISTED_ERRORS)
                    .map((item, i) => (
                      <li key={i}>
                        <p className="text-xs font-medium tabular-nums text-slate-400">
                          {item.label} · {item.cell}
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
