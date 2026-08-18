import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { readInventoryText } from '../../store/inventoryUpdates';
import type { InventoryUpdateLine } from '../../types/inventoryUpdate';

const PLACEHOLDER = '예) 우유 3개 남았고 즉석밥은 다 나갔어요';

/** AI가 실제로 문장을 이해하는 데 걸리는 시간은 사람이 체감하기 너무 짧다.
 *  이 최소 시간만큼은 "정리하고 있습니다" 상태를 보여준다 — 그 이상 억지로 늘리지 않는다. */
const MIN_ANALYZING_MS = 450;

const QUICK_EXAMPLES = ['라면 5개 남음', '생수 다 나감', '우유 10개 들어옴'];

interface QuickInventoryInputProps {
  /** 이 읍면동에 이미 등록된 품목명. 해석 정확도를 크게 올린다. */
  knownItems: string[];
  disabled: boolean;
  /** 읽어낸 줄을 확인 화면으로 넘긴다. */
  onRead: (lines: InventoryUpdateLine[], notice: string | null) => void;
  /** AI가 분석 중인 동안 true. 부모가 이 시간 동안 전용 화면을 보여준다. */
  onAnalyzingChange: (analyzing: boolean) => void;
}

/**
 * 자연어 AI 입력.
 *
 * 이 기능의 핵심 동선이다. 대량 반영은 [Excel 업로드]가 보조로 맡는다.
 * 읽은 결과는 절대 바로 저장하지 않고 항상 확인 화면을 거친다.
 */
export default function QuickInventoryInput({
  knownItems,
  disabled,
  onRead,
  onAnalyzingChange,
}: QuickInventoryInputProps) {
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRead() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setReading(true);
    setError(null);
    onAnalyzingChange(true);
    const startedAt = Date.now();

    try {
      const result = await readInventoryText(trimmed, knownItems);
      await waitAtLeast(startedAt);

      if (result.lines.length === 0) {
        setError('내용을 자동으로 정리하지 못했습니다. 문장을 조금 더 간단하게 입력해 주세요.');
        return;
      }

      const notices: string[] = [];
      if (result.engine === 'ai') notices.push('AI가 문장을 읽었습니다.');
      if (result.fallbackReason) notices.push('자동 분석 결과를 확인해 주세요.');
      if (result.leftovers.length > 0) {
        notices.push(`읽지 못하고 남은 부분: ${result.leftovers.join(' / ')}`);
      }

      onRead(
        result.lines.map((line) => ({
          itemName: line.itemName,
          stock: line.stock,
          expirationDate: null,
          sourceText: line.sourceText,
          issue: line.issue,
        })),
        notices.length > 0 ? notices.join(' ') : null,
      );
      setText('');
    } catch {
      await waitAtLeast(startedAt);
      setError('내용을 자동으로 정리하지 못했습니다. 문장을 조금 더 간단하게 입력해 주세요.');
    } finally {
      setReading(false);
      onAnalyzingChange(false);
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor="quick-inventory-text" className="block text-sm font-semibold text-slate-800">
        현재 재고 상황을 알려주세요
      </label>
      <textarea
        id="quick-inventory-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // 줄바꿈은 그대로 두고, Ctrl/⌘+Enter 로 바로 AI 분석까지 간다.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleRead();
        }}
        rows={5}
        disabled={disabled}
        placeholder={PLACEHOLDER}
        className="min-h-[160px] w-full resize-y rounded-2xl border border-slate-200 px-5 py-4 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#004696] focus:outline-none focus:ring-4 focus:ring-[#004696]/10 disabled:bg-slate-50"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">빠른 예시</span>
        {QUICK_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled}
            onClick={() => setText(example)}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-[#004696] hover:bg-[#EAF3FC] hover:text-[#004696] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {example}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-xs text-slate-400">
          바로 저장하지 않습니다. AI가 읽은 내용을 보고 고친 뒤 반영합니다.
        </span>
        <button
          type="button"
          onClick={() => void handleRead()}
          disabled={disabled || reading || text.trim() === ''}
          className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-[#004696] px-6 text-sm font-bold text-white transition-colors hover:bg-[#00356F] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] focus-visible:ring-offset-2"
        >
          <Sparkles size={16} />
          {reading ? '정리하는 중...' : 'AI로 재고 정리하기'}
        </button>
      </div>
    </div>
  );
}

function waitAtLeast(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= MIN_ANALYZING_MS) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, MIN_ANALYZING_MS - elapsed));
}
