import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 중앙 DB가 모든 화면의 source of truth다.
// 환경변수가 없으면 화면은 "중앙 저장소가 설정되지 않았습니다" 안내만 띄운다.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isCentralStoreEnabled = supabase !== null;
