import { useMemo, useRef, useState } from 'react';
import { Camera, Images, Minus, Navigation, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import AppHeader from '../../components/citizen/ui/AppHeader';
import Button from '../../components/citizen/ui/Button';
import { ChoiceGroup, Field, Select, TextInput } from '../../components/citizen/ui/Form';
import { DonePanel, ErrorNote, Loading } from '../../components/citizen/ui/Feedback';
import { useCitizenPlaces } from '../../hooks/useCitizenPlaces';
import { distanceText, recommendPlaces } from '../../utils/citizenPlace';
import { kakaoDirectionsUrl } from '../../lib/geo';
import { AREA_LIST } from '../../data/mockSites';
import {
  analyzeImage,
  createDonation,
  uploadDonationPhoto,
  type DonationMethod,
} from '../../store/donations';

type Stage = 'photo' | 'method' | 'done';
type PhotoSub = 'idle' | 'uploading' | 'analyzing' | 'result' | 'manual';

interface EditableItem {
  name: string;
  category: string;
  quantity: number;
  quantityWasNull: boolean;
}

const METHODS = [
  { value: 'SELF_DELIVER', label: '직접 가져갈게요' },
  { value: 'PICKUP_NEEDED', label: '가지러 와주세요' },
] as const;

/**
 * 물품 기부.
 *
 * AI 를 자랑하지 않는다 — "Gemini Vision" 같은 말은 화면 어디에도 없다. 사용자가 느껴야 할 것은
 * **"사진 찍었더니 알아서 입력됐다"** 하나뿐이라, 인식 결과도 배지나 신뢰도가 아니라
 * "라면 5개로 보여요" 라는 한 문장과 [맞아요] / [수정] 두 개의 선택으로만 낸다.
 *
 * 업로드·인식·저장 로직은 기존 그대로다(Supabase Storage → Edge Function → donations).
 */
export default function CitizenDonatePage() {
  const [stage, setStage] = useState<Stage>('photo');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [sub, setSub] = useState<PhotoSub>('idle');
  const [aiItems, setAiItems] = useState<EditableItem[]>([]);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [region, setRegion] = useState('');
  const [method, setMethod] = useState<DonationMethod | null>(null);
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef(0);

  const { places } = useCitizenPlaces();
  const area = useMemo(() => AREA_LIST.find((a) => a.area === region) ?? null, [region]);
  const target = useMemo(() => {
    if (!area || method !== 'SELF_DELIVER') return null;
    return recommendPlaces(places, { lat: area.lat, lng: area.lng }, 1)[0] ?? null;
  }, [area, method, places]);

  async function handlePick(file: File | undefined) {
    if (!file) return;
    const v = ++versionRef.current;

    setPhoto(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setUploadedPath(null);
    setAiItems([]);
    setAiNote(null);
    setSub('uploading');

    let path: string | null = null;
    try {
      path = await uploadDonationPhoto(file);
    } catch {
      if (versionRef.current !== v) return;
      setSub('manual');
      setAiNote('사진을 저장하지 못했어요. 무엇인지 직접 알려주세요.');
      return;
    }

    if (versionRef.current !== v) return;
    setUploadedPath(path);
    setSub('analyzing');

    try {
      const result = await analyzeImage(path);
      if (versionRef.current !== v) return;

      if (result.needs_review || result.items.length === 0) {
        setSub('manual');
        setAiNote(result.message ?? '사진만으로는 확인이 어려워요. 무엇인지 알려주세요.');
        return;
      }

      setAiItems(
        result.items.map((it) => ({
          name: it.name,
          category: it.category,
          quantity: it.quantity ?? 1,
          quantityWasNull: it.quantity === null,
        })),
      );
      setAiNote(result.message ?? null);
      setSub('result');
    } catch {
      if (versionRef.current !== v) return;
      setSub('manual');
      // 원인(네트워크·서버 오류)은 사용자에게 알려 줄 이유가 없다 — 다음에 할 일만 말한다.
      setAiNote('사진만으로는 확인이 어려워요. 무엇인지 알려주세요.');
    }
  }

  function handleRemovePhoto() {
    versionRef.current++;
    setPhoto(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUploadedPath(null);
    setAiItems([]);
    setSub('idle');
    setAiNote(null);
    setManualName('');
    setManualQty(1);
  }

  function updateItem(i: number, changes: Partial<EditableItem>) {
    setAiItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...changes } : it)));
  }

  function removeItem(i: number) {
    setAiItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function goToManual() {
    setManualName(aiItems[0]?.name ?? '');
    setManualQty(aiItems[0]?.quantity ?? 1);
    setSub('manual');
  }

  function handleConfirmManual() {
    if (!manualName.trim()) return;
    setAiItems([{ name: manualName.trim(), category: '기타', quantity: manualQty, quantityWasNull: false }]);
    setStage('method');
  }

  const canSubmit =
    region.trim().length > 0 &&
    method !== null &&
    aiItems.length > 0 &&
    !submitting &&
    (method !== 'PICKUP_NEEDED' || contact.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !method) return;
    setSubmitting(true);
    setError(null);
    try {
      const shared = {
        region,
        donationMethod: method,
        donorContact: method === 'PICKUP_NEEDED' ? contact.trim() : undefined,
        targetSiteId: method === 'SELF_DELIVER' ? (target?.id ?? undefined) : undefined,
      };

      if (uploadedPath) {
        await Promise.all(
          aiItems.map((item) =>
            createDonation({ itemName: item.name, quantity: item.quantity, imagePath: uploadedPath, ...shared }),
          ),
        );
      } else if (photo) {
        await createDonation({
          itemName: aiItems[0].name,
          quantity: aiItems[0].quantity,
          photo,
          ...shared,
        });
      } else {
        throw new Error('사진이 없어요. 다시 시도해 주세요.');
      }

      setStage('done');
    } catch (err) {
      console.error('[CitizenDonatePage]', err);
      setError('보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── 완료 ───────────────────────────────────────────────────────────────────

  if (stage === 'done') {
    return (
      <>
        <AppHeader title="물품 기부" backTo="/" />
        <DonePanel title="나눔을 보냈어요" description="담당자가 확인하고 연락드릴게요. 고맙습니다." />
      </>
    );
  }

  // ─── 전달 방법 ──────────────────────────────────────────────────────────────

  if (stage === 'method') {
    return (
      <>
        <AppHeader title="물품 기부" onBack={() => setStage('photo')} />
        <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
          <h2 className="text-title text-ink-950">어떻게 전달할까요?</h2>

          <div className="mt-6 space-y-6">
            <Field label="사는 동네" htmlFor="donate-region">
              <Select id="donate-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택해 주세요</option>
                {AREA_LIST.map((a) => (
                  <option key={a.area} value={a.area}>
                    {a.area}
                  </option>
                ))}
              </Select>
            </Field>

            <ChoiceGroup label="전달 방법" choices={METHODS} value={method} onChange={setMethod} />

            {method === 'SELF_DELIVER' && target && (
              <div className="rounded-card border border-brand-200 bg-brand-50 p-4">
                <p className="text-note font-bold text-brand-700">여기로 가져다주세요</p>
                <p className="mt-1 text-section text-ink-950">{target.displayName}</p>
                {target.distanceKm !== null && (
                  <p className="mt-1 text-body text-ink-600">
                    {region}에서 {distanceText(target.distanceKm)}
                  </p>
                )}
                <div className="mt-4">
                  <Button
                    href={kakaoDirectionsUrl(target.name, { lat: target.lat, lng: target.lng })}
                    icon={Navigation}
                    variant="secondary"
                    size="md"
                  >
                    길찾기
                  </Button>
                </div>
              </div>
            )}

            {method === 'PICKUP_NEEDED' && (
              <Field label="연락받을 번호" htmlFor="donate-contact">
                <TextInput
                  id="donate-contact"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="010-0000-0000"
                />
              </Field>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? '보내는 중이에요' : '나눔 보내기'}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ─── 사진 ───────────────────────────────────────────────────────────────────

  const working = sub === 'uploading' || sub === 'analyzing';
  const single = sub === 'result' && aiItems.length === 1;
  const multiple = sub === 'result' && aiItems.length > 1;

  return (
    <>
      <AppHeader title="물품 기부" />
      <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
        <h2 className="text-title text-ink-950">무엇을 나눌까요?</h2>

        <div className="mt-6 space-y-5">
          {previewUrl ? (
            <div className="overflow-hidden rounded-card border border-line-200">
              <img src={previewUrl} alt="나눌 물품 사진" className="aspect-square w-full object-cover" />
              {!working && (
                <div className="flex gap-1 border-t border-line-100 bg-surface p-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="tap-md flex flex-1 items-center justify-center gap-1.5 rounded-control text-body font-semibold text-ink-600 hover:bg-line-100 focus-ring"
                  >
                    <RefreshCw size={18} aria-hidden /> 다시 찍기
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="tap-md flex flex-1 items-center justify-center gap-1.5 rounded-control text-body font-semibold text-stop-600 hover:bg-stop-50 focus-ring"
                  >
                    <Trash2 size={18} aria-hidden /> 지우기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button onClick={() => cameraRef.current?.click()} icon={Camera}>
                사진 찍기
              </Button>
              <Button onClick={() => galleryRef.current?.click()} variant="secondary" size="md" icon={Images}>
                사진에서 선택
              </Button>
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />

          {working && <Loading label={sub === 'uploading' ? '사진을 올리고 있어요' : '무엇인지 보고 있어요'} />}

          {/* 인식 결과 — 한 가지 */}
          {single && (
            <>
              <p className="text-title text-ink-950">
                {aiItems[0].quantityWasNull
                  ? `${aiItems[0].name}으로 보여요`
                  : `${aiItems[0].name} ${aiItems[0].quantity}개로 보여요`}
              </p>

              <QuantityStepper
                label={aiItems[0].quantityWasNull ? '몇 개인가요?' : '수량'}
                value={aiItems[0].quantity}
                onChange={(quantity) => updateItem(0, { quantity })}
              />

              <div className="space-y-2 pt-1">
                <Button onClick={() => setStage('method')}>맞아요</Button>
                <Button variant="quiet" onClick={goToManual}>
                  수정
                </Button>
              </div>
            </>
          )}

          {/* 인식 결과 — 여러 가지 */}
          {multiple && (
            <>
              <p className="text-title text-ink-950">{aiItems.length}가지로 보여요</p>
              <ul className="divide-y divide-line-100 overflow-hidden rounded-card border border-line-200">
                {aiItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 p-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      aria-label={`${i + 1}번째 물품 이름`}
                      className="min-w-0 flex-1 bg-transparent px-1 text-body font-semibold text-ink-950 outline-none focus-ring"
                    />
                    <button
                      type="button"
                      onClick={() => updateItem(i, { quantity: Math.max(1, item.quantity - 1) })}
                      aria-label={`${item.name} 하나 줄이기`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-line-200 text-ink-800 hover:border-brand-300 focus-ring"
                    >
                      <Minus size={18} aria-hidden />
                    </button>
                    <span className="w-7 text-center text-lead font-bold text-ink-950">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateItem(i, { quantity: item.quantity + 1 })}
                      aria-label={`${item.name} 하나 늘리기`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-line-200 text-ink-800 hover:border-brand-300 focus-ring"
                    >
                      <Plus size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      aria-label={`${item.name} 목록에서 빼기`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-400 hover:bg-stop-50 hover:text-stop-600 focus-ring"
                    >
                      <X size={18} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 pt-1">
                <Button onClick={() => setStage('method')} disabled={aiItems.length === 0}>
                  맞아요
                </Button>
                <Button variant="quiet" onClick={goToManual}>
                  수정
                </Button>
              </div>
            </>
          )}

          {/* 사진만으로 확인이 안 될 때 */}
          {sub === 'manual' && (
            <>
              {aiNote && <p className="rounded-card bg-warn-50 px-4 py-3 text-body text-warn-700">{aiNote}</p>}

              <Field label="무엇인가요?" htmlFor="donate-item-name">
                <TextInput
                  id="donate-item-name"
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="예: 라면, 쌀, 기저귀"
                />
              </Field>

              <QuantityStepper label="수량" value={manualQty} onChange={setManualQty} />

              <Button onClick={handleConfirmManual} disabled={!manualName.trim()}>
                다음
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** 수량 조절. 숫자를 키보드로 치게 하지 않는다 — 큰 버튼 두 개가 훨씬 빠르고 안 틀린다. */
function QuantityStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-lead font-bold text-ink-950">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          aria-label="하나 줄이기"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-line-200 text-ink-800 hover:border-brand-300 focus-ring"
        >
          <Minus size={22} aria-hidden />
        </button>
        <output aria-label="선택한 수량" className="flex-1 text-center text-title text-ink-950">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label="하나 늘리기"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-line-200 text-ink-800 hover:border-brand-300 focus-ring"
        >
          <Plus size={22} aria-hidden />
        </button>
      </div>
    </div>
  );
}
