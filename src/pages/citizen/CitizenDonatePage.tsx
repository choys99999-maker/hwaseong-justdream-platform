import { useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Images, Minus, Navigation, Plus, RefreshCw, Trash2 } from 'lucide-react';
import CitizenPageHeader from '../../components/citizen/CitizenPageHeader';
import BigButton from '../../components/citizen/BigButton';
import { useCitizenSites } from '../../hooks/useCitizenSites';
import { recommendCitizenSites } from '../../utils/citizenSite';
import { formatDistance, kakaoDirectionsUrl } from '../../lib/geo';
import { AREA_LIST } from '../../data/mockSites';
import { createDonation, type DonationMethod } from '../../store/donations';

type Stage = 'photo' | 'method' | 'done';

/**
 * Drawer → 물품 기부. 사진 찍기 → 물품 확인(품목명·수량 직접 입력, AI 인식 없음) →
 * 전달 방법(직접 가져갈게요 / 수거가 필요해요) → 완료. 선택지는 늘 둘 이하로 유지한다.
 */
export default function CitizenDonatePage() {
  const [stage, setStage] = useState<Stage>('photo');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [region, setRegion] = useState('');
  const [method, setMethod] = useState<DonationMethod | null>(null);
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { sites } = useCitizenSites();

  const area = useMemo(() => AREA_LIST.find((a) => a.area === region) ?? null, [region]);
  const recommendedSite = useMemo(() => {
    if (!area || method !== 'SELF_DELIVER') return null;
    return recommendCitizenSites(sites, { lat: area.lat, lng: area.lng }, 1)[0] ?? null;
  }, [area, method, sites]);

  function handlePick(file: File | undefined) {
    if (!file) return;
    setPhoto(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleRemovePhoto() {
    setPhoto(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  const canContinueFromPhoto = photo !== null && itemName.trim().length > 0 && quantity > 0;
  const canSubmit =
    region.trim().length > 0 &&
    method !== null &&
    !submitting &&
    (method !== 'PICKUP_NEEDED' || contact.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !photo || !method) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDonation({
        itemName: itemName.trim(),
        quantity,
        photo,
        region,
        donationMethod: method,
        donorContact: method === 'PICKUP_NEEDED' ? contact.trim() : undefined,
        targetSiteId: method === 'SELF_DELIVER' ? (recommendedSite?.id ?? undefined) : undefined,
      });
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '기부 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <CheckCircle2 size={36} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">기부 요청을 보냈어요.</h1>
        <p className="text-lg text-slate-600">담당자가 확인 후 연락드릴게요. 나눠주셔서 감사해요.</p>
        <div className="mt-4 w-full max-w-xs">
          <BigButton to="/" variant="secondary">
            지도로 돌아가기
          </BigButton>
        </div>
      </div>
    );
  }

  if (stage === 'photo') {
    return (
      <div className="px-0 pb-[max(40px,env(safe-area-inset-bottom))]">
        <CitizenPageHeader title="무엇을 나눌까요?" />

        <div className="mt-5 space-y-5 px-5">
          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <img src={previewUrl} alt="기부할 물품 사진" className="aspect-square w-full object-cover" />
              <div className="flex gap-2 border-t border-slate-200 bg-white p-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl text-base font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw size={17} aria-hidden /> 교체
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl text-base font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={17} aria-hidden /> 삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <BigButton onClick={() => cameraInputRef.current?.click()} icon={Camera}>
                사진 찍기
              </BigButton>
              <BigButton onClick={() => galleryInputRef.current?.click()} variant="secondary" icon={Images}>
                사진에서 선택
              </BigButton>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />

          {photo && (
            <>
              <div>
                <label htmlFor="donate-item-name" className="mb-2 block text-lg font-bold text-slate-800">
                  품목명
                </label>
                <input
                  id="donate-item-name"
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="예: 라면, 쌀, 기저귀"
                  className="min-h-[56px] w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <p className="mb-2 text-lg font-bold text-slate-800">수량</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="수량 줄이기"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 text-slate-700 hover:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
                  >
                    <Minus size={20} aria-hidden />
                  </button>
                  <span className="min-w-[3ch] flex-1 text-center text-2xl font-bold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="수량 늘리기"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 text-slate-700 hover:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
                  >
                    <Plus size={20} aria-hidden />
                  </button>
                </div>
              </div>

              <BigButton onClick={() => setStage('method')} disabled={!canContinueFromPhoto}>
                다음
              </BigButton>
            </>
          )}
        </div>
      </div>
    );
  }

  // stage === 'method'
  return (
    <div className="px-0 pb-[max(40px,env(safe-area-inset-bottom))]">
      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={() => setStage('photo')}
          className="inline-flex min-h-[48px] items-center text-lg font-medium text-slate-500 hover:text-teal-700"
        >
          ← 사진 다시 보기
        </button>
        <h1 className="mt-3 text-[24px] font-bold leading-snug text-slate-900">어떻게 전달할까요?</h1>
      </div>

      <div className="mt-5 space-y-5 px-5">
        <div>
          <label htmlFor="donate-region" className="mb-2 block text-lg font-bold text-slate-800">
            사는 동네
          </label>
          <select
            id="donate-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="min-h-[56px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
          >
            <option value="">선택해 주세요</option>
            {AREA_LIST.map((a) => (
              <option key={a.area} value={a.area}>
                {a.area}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {(
            [
              { value: 'SELF_DELIVER', label: '직접 가져갈게요' },
              { value: 'PICKUP_NEEDED', label: '수거가 필요해요' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMethod(opt.value)}
              aria-pressed={method === opt.value}
              className={`min-h-[56px] rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40 ${
                method === opt.value
                  ? 'border-teal-600 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {method === 'SELF_DELIVER' && area && recommendedSite && (
          <div className="rounded-2xl border-2 border-teal-600 bg-teal-50/40 p-4">
            <p className="text-base font-semibold text-teal-800">이 거점으로 가져다주세요</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{recommendedSite.displayName}</h2>
            <p className="mt-1 text-base text-slate-600">
              {recommendedSite.distanceKm !== null ? formatDistance(recommendedSite.distanceKm) : recommendedSite.address}
            </p>
            <div className="mt-3">
              <BigButton
                href={kakaoDirectionsUrl(recommendedSite.name, { lat: recommendedSite.lat, lng: recommendedSite.lng })}
                icon={Navigation}
                size="md"
              >
                길찾기
              </BigButton>
            </div>
          </div>
        )}

        {method === 'PICKUP_NEEDED' && (
          <div>
            <label htmlFor="donate-contact" className="mb-2 block text-lg font-bold text-slate-800">
              연락받을 번호
            </label>
            <input
              id="donate-contact"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="010-0000-0000"
              className="min-h-[56px] w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
            />
          </div>
        )}

        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-700">{error}</p>}

        <BigButton onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? '보내는 중...' : '기부 요청 보내기'}
        </BigButton>
      </div>
    </div>
  );
}
