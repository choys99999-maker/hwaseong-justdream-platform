import { CheckCircle2, Columns3, FileUp, Loader2, ShieldCheck, type LucideIcon } from 'lucide-react';

export type UploadStep = 'select' | 'uploading' | 'columns' | 'validation' | 'done';

interface StepMeta {
  key: UploadStep;
  label: string;
  icon: LucideIcon;
}

const STEPS: StepMeta[] = [
  { key: 'select', label: '파일 선택', icon: FileUp },
  { key: 'uploading', label: '업로드', icon: Loader2 },
  { key: 'columns', label: '열 인식 결과', icon: Columns3 },
  { key: 'validation', label: '누락·중복·오류 확인', icon: ShieldCheck },
  { key: 'done', label: '통합 반영 완료', icon: CheckCircle2 },
];

interface UploadStepperProps {
  currentStep: UploadStep;
}

export default function UploadStepper({ currentStep }: UploadStepperProps) {
  const currentIndex = STEPS.findIndex((step) => step.key === currentStep);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                isCurrent
                  ? 'bg-teal-600 text-white'
                  : isCompleted
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Icon size={16} className={isCurrent && step.key === 'uploading' ? 'animate-spin' : ''} />
              {step.label}
            </div>
            {index < STEPS.length - 1 && <div className="h-px w-6 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}
