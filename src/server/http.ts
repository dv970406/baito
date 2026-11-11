/**
 * Route Handler 공용 응답 도우미.
 * - 모든 응답에 `Cache-Control: no-store` (플레이어별 데이터라 캐시 금지)
 * - withApi 가 예외를 ApiErrorBody 로 변환한다. 스택은 서버 로그에만 남긴다.
 */
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { ApiErrorBody } from "@/shared/api";
import { RepositoryUnavailableError } from "./repository";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** 성공 JSON 응답 */
export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return res;
}

/** 오류 JSON 응답 — 본문은 항상 ApiErrorBody */
export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return jsonOk(body, { status });
}

/**
 * 라우트 안에서 "정상적인 실패"를 표현할 때 던진다 (예: 409 PROFILE_REQUIRED).
 * withApi 가 그대로 ApiErrorBody 응답으로 바꾼다.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiHandler = (req: NextRequest) => Promise<Response>;

/**
 * 핸들러를 감싸 예외를 상태 코드로 매핑한다.
 *   ZodError                   → 400 VALIDATION_ERROR (flatten 된 issues)
 *   SyntaxError (req.json())   → 400 INVALID_JSON
 *   RepositoryUnavailableError → 503 SUPABASE_NOT_CONFIGURED
 *   ApiError                   → 지정한 status/code
 *   그 외                      → 500 INTERNAL_ERROR (console.error 만, 클라이언트에는 노출 안 함)
 *   Next 내부 예외(unstable_rethrow 대상) 는 다시 던진다
 */
export function withApi(handler: ApiHandler): ApiHandler {
  return async (req) => {
    try {
      const res = await handler(req);
      if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      // Next 내부 제어 예외(프리렌더 중단, connection() 거부 등)는 삼키지 않고 그대로 넘긴다
      unstable_rethrow(err);
      if (err instanceof z.ZodError) {
        return jsonError("VALIDATION_ERROR", "요청 값이 올바르지 않습니다.", 400, z.flattenError(err));
      }
      if (err instanceof SyntaxError) {
        return jsonError("INVALID_JSON", "요청 본문이 올바른 JSON 이 아닙니다.", 400);
      }
      if (err instanceof RepositoryUnavailableError) {
        return jsonError(
          "SUPABASE_NOT_CONFIGURED",
          "서버에 데이터 백엔드가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 확인하세요.",
          503,
        );
      }
      if (err instanceof ApiError) {
        return jsonError(err.code, err.message, err.status, err.details);
      }
      console.error("[api] unhandled error", err);
      return jsonError("INTERNAL_ERROR", "서버 내부 오류가 발생했습니다.", 500);
    }
  };
}
