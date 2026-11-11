/**
 * 프로필 동기화의 last-write-wins 판정.
 * repository.ts 와 구현체 사이의 순환 import 를 피하기 위해 별도 모듈로 둔다.
 */
import type { PlayerProfile } from "@/shared/player";

/**
 * 들어온 프로필이 저장된 것보다 오래됐는지(= 무시해야 하는지) 판단한다.
 * updatedAt 파싱 실패 시 0 으로 취급해 새 값이 이긴다. 같은 시각이면 들어온 값이 이긴다.
 */
export function isIncomingOlder(stored: PlayerProfile | null, incoming: PlayerProfile): boolean {
  if (!stored) return false;
  const storedAt = Date.parse(stored.updatedAt) || 0;
  const incomingAt = Date.parse(incoming.updatedAt) || 0;
  return incomingAt < storedAt;
}
