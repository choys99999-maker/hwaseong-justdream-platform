import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  FileSpreadsheet,
  FileUp,
  Folder,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Loader2,
  MapPin,
  MapPinned,
  PackageOpen,
  PackageSearch,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UploadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';

interface IconEntry {
  name: string;
  icon: LucideIcon;
  usage: string;
}

const ICONS: IconEntry[] = [
  { name: 'LayoutDashboard', icon: LayoutDashboard, usage: '통합 대시보드' },
  { name: 'MapPinned',       icon: MapPinned,       usage: '지역별 현황' },
  { name: 'ClipboardList',   icon: ClipboardList,   usage: '이용·지원 내역' },
  { name: 'PackageSearch',   icon: PackageSearch,   usage: '물품·유통기한' },
  { name: 'UploadCloud',     icon: UploadCloud,     usage: '데이터 업로드' },
  { name: 'FileUp',          icon: FileUp,          usage: '파일 선택 (스텝)' },
  { name: 'Loader2',         icon: Loader2,         usage: '업로드 중 (스텝)' },
  { name: 'Columns3',        icon: Columns3,        usage: '열 인식 결과 (스텝)' },
  { name: 'ShieldCheck',     icon: ShieldCheck,     usage: '누락·중복 확인 (스텝)' },
  { name: 'CheckCircle2',    icon: CheckCircle2,    usage: '통합 반영 완료 (스텝)' },
  { name: 'FolderOpen',      icon: FolderOpen,      usage: '파일 선택 드롭존' },
  { name: 'Upload',          icon: Upload,          usage: '드래그 업로드 힌트' },
  { name: 'FileSpreadsheet', icon: FileSpreadsheet, usage: '엑셀 파일 표시' },
  { name: 'Folder',          icon: Folder,          usage: '헤더 파일 선택' },
  { name: 'AlertCircle',     icon: AlertCircle,     usage: '오류 알림' },
  { name: 'ArrowLeft',       icon: ArrowLeft,       usage: '이전 단계' },
  { name: 'ArrowRight',      icon: ArrowRight,      usage: '다음 단계' },
  { name: 'RotateCcw',       icon: RotateCcw,       usage: '새 파일 선택 (초기화)' },
  { name: 'Trash2',          icon: Trash2,          usage: '파일 삭제' },
  { name: 'ClipboardCheck',  icon: ClipboardCheck,  usage: '지원 건수 통계' },
  { name: 'MapPin',          icon: MapPin,          usage: '지역 마커' },
  { name: 'Users',           icon: Users,           usage: '이용자 수' },
  { name: 'Search',          icon: Search,          usage: '검색' },
  { name: 'Inbox',           icon: Inbox,           usage: '빈 상태 표시' },
  { name: 'Boxes',           icon: Boxes,           usage: '물품 현황' },
  { name: 'CalendarClock',   icon: CalendarClock,   usage: '유통기한' },
  { name: 'PackageOpen',     icon: PackageOpen,     usage: '품목 상세' },
];

export default function IconsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="아이콘 목록 (테스트 5)"
        description={`앱에서 사용 중인 Lucide React 아이콘 ${ICONS.length}종`}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {ICONS.map(({ name, icon: Icon, usage }) => (
          <div
            key={name}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-teal-300 hover:bg-teal-50/40 transition-colors"
          >
            <Icon size={28} className="text-teal-600" />
            <p className="text-[11px] font-semibold text-slate-800 break-all leading-tight">{name}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{usage}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
