/**
 * 서버 환경변수 — zod 로 느슨하게 파싱한다.
 * import 시점에는 절대 던지지 않고, 실제로 필요한 순간(getEnv / resolveBackend)에만 평가한다.
 * 빌드(prerender) 단계에서 Supabase 키가 없어도 모듈 로드가 실패하지 않아야 하기 때문.
 */
import { z } from "zod";

/** 빈 문자열은 "설정 안 함"으로 취급한다 (.env.example 의 `KEY=` 형태) */
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalString.pipe(z.url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  BAITO_DATA_BACKEND: optionalString.pipe(z.enum(["supabase", "memory"]).optional()),
  NODE_ENV: optionalString,
});

export type ServerEnv = z.infer<typeof envSchema>;

/**
 * 현재 process.env 를 읽어 파싱한다. 매 호출마다 다시 읽는다(테스트에서 env 를 바꿔가며 검증하기 위함).
 * 잘못된 값(예: BAITO_DATA_BACKEND=foo, URL 형식 오류)은 ZodError 로 던진다.
 */
export function getEnv(): ServerEnv {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BAITO_DATA_BACKEND: process.env.BAITO_DATA_BACKEND,
    NODE_ENV: process.env.NODE_ENV,
  });
}

export type ResolvedBackend = "supabase" | "memory" | "unconfigured";

/**
 * 데이터 백엔드 결정 규칙 (.env.example 참고)
 * 1. BAITO_DATA_BACKEND 가 명시되면 그 값을 따른다.
 * 2. 아니면 Supabase URL + service_role 키가 모두 있으면 "supabase".
 * 3. 아니면 개발/테스트 환경(NODE_ENV !== 'production')에서는 "memory".
 * 4. 프로덕션인데 키가 없으면 "unconfigured" → API 는 503 을 응답한다.
 */
export function resolveBackend(): ResolvedBackend {
  const env = getEnv();
  if (env.BAITO_DATA_BACKEND) return env.BAITO_DATA_BACKEND;
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (env.NODE_ENV !== "production") return "memory";
  return "unconfigured";
}
