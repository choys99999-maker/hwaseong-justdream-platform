import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';

/**
 * 입력 한 칸. 라벨은 항상 보이고(placeholder 를 라벨로 쓰지 않는다), 선택 항목만
 * 라벨 안에 "(선택)" 을 붙인다 — 모든 칸에 필수/선택 알약을 다는 식으로 화면을 채우지 않는다.
 */
export function Field({
  label,
  htmlFor,
  optional = false,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-lead font-bold text-ink-950">
        {label}
        {optional && <span className="ml-1.5 text-note font-normal text-ink-600">(선택)</span>}
      </label>
      {hint && <p className="mb-2 -mt-1 text-note text-ink-600">{hint}</p>}
      {children}
    </div>
  );
}

const CONTROL =
  'tap-lg w-full rounded-control border border-line-200 bg-surface px-4 py-3 text-body text-ink-950 ' +
  'placeholder:text-ink-400 outline-none transition-colors focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} resize-none leading-relaxed ${props.className ?? ''}`} />;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/**
 * 하나만 고르는 선택지 묶음.
 *
 * 선택된 항목은 색만 바뀌지 않는다 — 체크 표시가 함께 붙어서 색을 구분하지 못해도
 * 무엇을 골랐는지 읽을 수 있다. `aria-pressed` 로 스크린리더에도 같은 사실이 간다.
 */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  columns = 1,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) {
  const groupId = useId();
  const gridClass = columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div role="group" aria-labelledby={groupId}>
      <p id={groupId} className="mb-2 text-lead font-bold text-ink-950">
        {label}
      </p>
      <div className={`grid gap-2 ${gridClass}`}>
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              onClick={() => onChange(choice.value)}
              aria-pressed={selected}
              className={`tap-lg flex items-center justify-center gap-1.5 rounded-control border px-3 py-3 text-body font-semibold transition-colors focus-ring ${
                selected
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-line-200 bg-surface text-ink-800 hover:border-brand-300'
              }`}
            >
              {selected && <Check size={18} className="shrink-0" aria-hidden />}
              <span>{choice.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 체크 하나. 라벨 전체가 터치 목표가 되도록 label 로 감싼다. */
export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="tap-md flex cursor-pointer items-center gap-3 text-body font-medium text-ink-950">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 shrink-0 rounded border-line-200 accent-brand-600 focus-ring"
      />
      {children}
    </label>
  );
}
