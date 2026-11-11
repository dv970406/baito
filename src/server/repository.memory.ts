/**
 * 인메모리 저장소 — 개발/테스트 전용.
 * 데이터는 globalThis 에 두어 Next dev 의 HMR(모듈 재평가) 후에도 살아남는다.
 */
import type { ShiftSummary } from "@/engine/types";
import type { LeagueDTO, LeagueEntryDTO, SessionDTO } from "@/shared/api";
import type { PlayerProfile } from "@/shared/player";
import { isIncomingOlder } from "./lww";
import type { Repository } from "./repository";
import { weekRangeFor } from "./week";

interface MemoryStore {
  profiles: Map<string, PlayerProfile>;
  sessions: SessionDTO[];
}

const STORE_KEY = "__baitoMemoryStore__";
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MemoryStore };

function getStore(): MemoryStore {
  const g = globalThis as GlobalWithStore;
  g[STORE_KEY] ??= { profiles: new Map(), sessions: [] };
  return g[STORE_KEY];
}

/** 테스트 간 격리를 위해 저장소를 비운다 */
export function resetMemoryRepository(): void {
  const g = globalThis as GlobalWithStore;
  g[STORE_KEY] = { profiles: new Map(), sessions: [] };
}

/** 깊은 복사 — 호출자가 돌려받은 객체를 바꿔도 저장소가 오염되지 않게 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryRepository implements Repository {
  private static instance: MemoryRepository | null = null;

  static shared(): MemoryRepository {
    MemoryRepository.instance ??= new MemoryRepository();
    return MemoryRepository.instance;
  }

  async getProfile(playerId: string): Promise<PlayerProfile | null> {
    const found = getStore().profiles.get(playerId);
    return found ? clone(found) : null;
  }

  async upsertProfile(playerId: string, profile: PlayerProfile): Promise<PlayerProfile> {
    const store = getStore();
    const stored = store.profiles.get(playerId) ?? null;
    if (isIncomingOlder(stored, profile)) return clone(stored as PlayerProfile);
    store.profiles.set(playerId, clone(profile));
    return clone(profile);
  }

  async createSession(playerId: string, summary: ShiftSummary): Promise<SessionDTO> {
    const session: SessionDTO = {
      id: crypto.randomUUID(),
      playerId,
      createdAt: new Date().toISOString(),
      summary: clone(summary),
    };
    getStore().sessions.push(session);
    return clone(session);
  }

  async listSessions(playerId: string, limit: number): Promise<SessionDTO[]> {
    const mine = getStore()
      .sessions.filter((s) => s.playerId === playerId)
      // createdAt 이 같으면 나중에 push 된 것이 뒤에 있으므로, 안정 정렬 후 뒤집는다
      .reverse()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return clone(mine.slice(0, limit));
  }

  async getLeague(playerId: string, weekStart: Date, weekEnd: Date): Promise<LeagueDTO> {
    const store = getStore();
    const startMs = weekStart.getTime();
    const endMs = weekEnd.getTime();

    const agg = new Map<string, { weeklyWageDelta: number; shifts: number }>();
    for (const s of store.sessions) {
      const playedAt = Date.parse(s.summary.playedAt);
      if (Number.isNaN(playedAt) || playedAt < startMs || playedAt >= endMs) continue;
      // 프로필이 없는(= players 행이 없는) 세션은 SQL 의 inner join 과 같이 제외
      const profile = store.profiles.get(s.playerId);
      if (!profile) continue;
      const cur = agg.get(s.playerId) ?? { weeklyWageDelta: 0, shifts: 0 };
      cur.weeklyWageDelta += s.summary.wageDelta;
      cur.shifts += 1;
      agg.set(s.playerId, cur);
    }

    const rows = [...agg.entries()]
      .map(([pid, a]) => {
        const profile = store.profiles.get(pid) as PlayerProfile;
        return { pid, name: profile.name, wage: profile.wage, ...a };
      })
      // SQL 함수와 같은 정렬: 주간 변동 desc, 시프트 수 desc, 시급 desc, id
      .sort(
        (a, b) =>
          b.weeklyWageDelta - a.weeklyWageDelta ||
          b.shifts - a.shifts ||
          b.wage - a.wage ||
          a.pid.localeCompare(b.pid),
      )
      .slice(0, 30);

    const entries: LeagueEntryDTO[] = rows.map((r, i) => ({
      playerId: r.pid,
      name: r.name,
      weeklyWageDelta: r.weeklyWageDelta,
      shifts: r.shifts,
      wage: r.wage,
      rank: i + 1,
      isMe: r.pid === playerId,
    }));

    return {
      weekStart: weekRangeFor(weekStart).label,
      entries,
      me: entries.find((e) => e.isMe) ?? null,
    };
  }
}
