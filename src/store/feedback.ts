// "말 남기기" 접근 계층. 익명이 기본이며, 답변을 원할 때만 연락처를 함께 저장한다.
import { supabase } from '../lib/supabase';

function client() {
  if (!supabase) throw new Error('중앙 저장소가 설정되지 않았습니다.');
  return supabase;
}

export interface FeedbackInput {
  message: string;
  anonymous: boolean;
  contact?: string;
}

export async function createFeedback(input: FeedbackInput): Promise<string> {
  const { data, error } = await client().rpc('create_feedback', {
    p_message: input.message,
    p_anonymous: input.anonymous,
    p_contact: input.anonymous ? null : (input.contact ?? null),
  });
  if (error) throw new Error(`전송에 실패했습니다: ${error.message}`);
  return data as string;
}
