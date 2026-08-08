import { Check } from 'lucide-react';

export type UploadStep = 'select' | 'uploading' | 'review' | 'importing' | 'done';

/** 화면에 보이는 단계는 3개뿐이다. 파일을 읽는 중·가져오는 중은 앞뒤 단계에 묶인다. */
const STEPS: Array<{ label: string; covers: UploadStep[] }> = [
  { label: '파일 선택', covers: ['select', 'uploading'] },
  { label: '확인', covers: ['review', 'importing'] },
  { label: '완료', covers: ['done'] },
];

interface UploadStepperProps {
  currentStep: UploadStep;
}

export default function UploadStepper({ currentStep }: UploadStepperProps) {
  const currentIndex = STEPS.findIndex((step) => step.covers.includes(currentStep));

  return (
    <ol className="flex items-center gap-3">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isCurrent
                    ? 'bg-teal-600 text-white'
                    : isCompleted
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isCompleted ? <Check size={12} strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={`text-sm ${isCurrent ? 'font-medium text-slate-900' : 'text-slate-400'}`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && <div className="h-px w-8 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}
