/**
 * GET /api/health — 서버 생존 확인 + 현재 데이터 백엔드.
 *
 * Cache Components(cacheComponents: true) 환경:
 * - `runtime` 세그먼트 설정은 지원되지 않으므로 export 하지 않는다 (문서: "remove the `runtime` export, including `runtime = 'nodejs'`").
 * - 이 핸들러는 요청 객체를 읽지 않아 빌드 시 정적으로 프리렌더될 수 있으므로,
 *   `await connection()` 으로 실제 요청이 올 때까지 렌더링을 미룬다.
 */
import { connection } from "next/server";
import type { HealthDTO } from "@/shared/api";
import { resolveBackend } from "@/server/env";
import { jsonError, jsonOk, withApi } from "@/server/http";

export const GET = withApi(async () => {
  await connection();
  const backend = resolveBackend();
  if (backend === "unconfigured") {
    return jsonError(
      "SUPABASE_NOT_CONFIGURED",
      "서버에 데이터 백엔드가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 확인하세요.",
      503,
    );
  }
  const body: HealthDTO = { ok: true, backend, time: new Date().toISOString() };
  return jsonOk(body);
});
