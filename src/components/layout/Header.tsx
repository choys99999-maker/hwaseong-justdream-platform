interface HeaderProps {
  title: string;
}

// 모든 화면이 중앙 DB의 전체 제출본을 함께 집계하므로
// "열람 중인 자료 1개를 고르는" 선택기는 더 이상 두지 않는다.
export default function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
    </header>
  );
}
