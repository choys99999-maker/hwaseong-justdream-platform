import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { readInventoryText } from '../../store/inventoryUpdates';
import type { InventoryUpdateLine } from '../../types/inventoryUpdate';

const PLACEHOLDER = '예) 우유 3개 남았고 즉석밥은 다 나갔어요';

interface QuickInventoryInputProps {
  /** 이 읍면동에 이미 등록된 품목명. 해석 정확도를 크게 올린다. */
  knownItems: string[];
  disabled: boolean;
  /** 읽어낸 줄을 확인 화면으로 넘긴다. */
  onRead: (lines: InventoryUpdateLine[], notice: string | null) => void;
}

/**
 * 자연어 빠른 입력.
 *
 * 현장에서 몇 개만 빠르게 고치는 입구다. 대량 반영은 [Excel로 한 번에 반영]이 맡는다.
 * 읽은 결과는 절대 바로 저장하지 않고 항상 확인 화면을 거친다.
 */
export default function QuickInventoryInput({
  knownItems,
  disabled,
  onRead,
}: QuickInventoryInputProps) {
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRead() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setReading(true);
    setError(null);
    try {
      const result = await readInventoryText(trimmed, knownItems);

      if (result.lines.length === 0) {
        setError(
          '품목을 찾지 못했습니다. "우유 3개 남았어요"처럼 품목과 수량을 함께 적어 주세요.',
        );
        return;
      }

      const notices: string[] = [];
      if (result.engine === 'ai') notices.push('AI가 문장을 읽었습니다.');
      if (result.fallbackReason) notices.push(result.fallbackReason);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '문장을 읽는 중 오류가 발생했습니다.');
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <label htmlFor="quick-inventory-text" className="block text-sm font-semibold text-slate-800">
        말하듯 입력해 주세요
      </label>
      <textarea
        id="quick-inventory-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // 줄바꿈은 그대로 두고, Ctrl/⌘+Enter 로 바로 확인 화면까지 간다.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleRead();
        }}
        rows={2}
        disabled={disabled}
        placeholder={PLACEHOLDER}
        className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50"
      />

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleRead()}
          disabled={disabled || reading || text.trim() === ''}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          <Sparkles size={15} />
          {reading ? '읽는 중...' : '내용 확인하기'}
        </button>
        <span className="text-xs text-slate-400">
          바로 저장하지 않습니다. 읽은 내용을 보고 고친 뒤 반영합니다.
        </span>
      </div>
    </div>
  );
}
