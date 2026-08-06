export type RegionId = 'seobu' | 'jungbu' | 'nambu' | 'dongbu' | 'dongtan';

export type OperationStatus = '정상' | '주의' | '확인 필요';

export interface MonthlyTrendPoint {
  month: string;
  count: number;
}

export interface Region {
  id: RegionId;
  name: string;
  status: OperationStatus;
  orgCount: number;
  userCount: number;
  monthlySupportCount: number;
  inventoryCount: number;
  expiringSoonCount: number;
  lastUpdated: string;
  monthlyTrend: MonthlyTrendPoint[];
}

export type CounselingStatus = '연계 완료' | '연계 진행중' | '미연계';

export interface SupportRecord {
  id: string;
  userName: string;
  regionId: RegionId;
  regionName: string;
  supportDate: string;
  item: string;
  quantity: number;
  counselingStatus: CounselingStatus;
}

export type InventoryStatus = '정상' | '임박' | '부족' | '확인 필요';

export interface InventoryItem {
  id: string;
  name: string;
  regionId: RegionId;
  regionName: string;
  inboundQuantity: number;
  outboundQuantity: number;
  currentStock: number;
  expiryDate: string;
  status: InventoryStatus;
}

export type DataIssueSeverity = '높음' | '중간' | '낮음';

export interface DataIssueAlert {
  id: string;
  title: string;
  description: string;
  regionName?: string;
  severity: DataIssueSeverity;
}
