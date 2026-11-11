/**
 * Supabase service_role 클라이언트 — 서버 전용.
 * `server-only` 를 import 하므로 클라이언트 컴포넌트에서 실수로 가져오면 빌드가 실패한다.
 * service_role 키는 RLS 를 우회하므로 절대 브라우저로 내보내지 않는다.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

let cached: SupabaseClient | null = null;

/** 서버 측 Supabase 클라이언트를 생성해 모듈 범위에 메모이즈한다. */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.",
    );
  }
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    // 서버에서는 세션을 보관할 이유가 없다(쿠키/로컬스토리지 없음)
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
