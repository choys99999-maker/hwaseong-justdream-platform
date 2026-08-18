import SideDrawer from '../common/SideDrawer';
import InventoryUpdatePanel from './InventoryUpdatePanel';
import { useCentralData } from '../../hooks/useCentralData';
import { listInventoryStatus } from '../../store/analytics';

interface InventoryUpdateDrawerProps {
  onClose: () => void;
  /** 반영 후 거점 관리 화면(재고 목록)이 다시 읽게 한다. */
  onApplied: () => void;
}

/**
 * 재고 업데이트 — 시청 관리자가 재고를 고치는 **유일한 입구**.
 *
 * 거점 관리 화면 오른쪽 위 [⚡ 재고 업데이트] 하나로만 열린다.
 * 안에서 자연어(빠른 수정)와 Excel(대량 수정)이 갈리지만, 담당자가 기억할 길은 하나뿐이다.
 */
export default function InventoryUpdateDrawer({ onClose, onApplied }: InventoryUpdateDrawerProps) {
  const { data } = useCentralData(() => listInventoryStatus(), []);

  return (
    <SideDrawer
      title="재고 업데이트"
      description="몇 개만 수정할 때는 말하듯 입력하고, 항목이 많을 때는 기존 Excel을 그대로 올릴 수 있습니다."
      width="lg"
      onClose={onClose}
    >
      <InventoryUpdatePanel inventory={data ?? []} onApplied={onApplied} />
    </SideDrawer>
  );
}
