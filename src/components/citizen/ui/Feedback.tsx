import type { ReactNode } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import Button from './Button';

/** 로딩. 문구 없이 도는 원만 두지 않는다 — 무엇을 기다리는지 항상 적는다. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-5 py-10" role="status">
      <span
        className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-line-200 border-t-brand-600 motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-body text-ink-600">{label}</p>
    </div>
  );
}

/** 오류 알림. 색만이 아니라 아이콘과 문장으로 알린다. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-card bg-stop-50 px-4 py-3 text-body text-stop-700"
    >
      <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** 빈 화면. 긴 설명 대신 다음에 할 일 한 문장으로 끝낸다. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-section text-ink-800">{title}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** 제출 완료 화면. 어느 기능에서든 같은 모양이라 "끝났다" 를 매번 새로 배우지 않아도 된다. */
export function DonePanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-open-50 text-open-600">
        <CheckCircle2 size={36} aria-hidden />
      </span>
      <h2 className="mt-4 text-title text-ink-950">{title}</h2>
      {description && <p className="mt-2 text-body text-ink-600">{description}</p>}
      <div className="mt-8 w-full max-w-[320px]">{children ?? <Button to="/" variant="secondary">지도로 돌아가기</Button>}</div>
    </div>
  );
}
