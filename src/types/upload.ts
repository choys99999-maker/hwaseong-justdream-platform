export type PlatformColumnKey =
  | 'region'
  | 'organization'
  | 'itemName'
  | 'inboundQuantity'
  | 'outboundQuantity'
  | 'stock'
  | 'inboundDate'
  | 'expirationDate';

export interface PlatformColumnDef {
  key: PlatformColumnKey;
  label: string;
  required: boolean;
  aliases: string[];
}

export interface MappedRecord {
  region?: string;
  organization?: string;
  itemName?: string;
  inboundQuantity?: number;
  outboundQuantity?: number;
  stock?: number;
  inboundDate?: string;
  expirationDate?: string;
}

export interface ValidationError {
  rowIndex: number;
  field: PlatformColumnKey;
  message: string;
}

export interface ConvertResult {
  records: MappedRecord[];
  errors: ValidationError[];
}
