"use client";

/**
 * 05 주간 시급 리그(時給リーグ).
 * 서버(/api/league)에서 이번 주 순위를 받아 보여준다. 서버가 없어도 화면이 비지 않도록
 * 로컬 영수증(sessions)으로 계산한 "나의 이번 주" 카드는 항상 그린다.
 */
import { useCallback, useEffect, useState } from "react";
import type { ShiftSummary } from "@/engine/types";
import type { LeagueDTO, LeagueEntryDTO } from "@/shared/api";
import { useGameStore } from "@/store/gameStore";
import { api, ApiError } from "@/store/sync";
import { localYmd } from "@/store/date";
import { formatDateJa } from "@/lib/format";
import { Badge, Card, CtaButton, Icon, ManagerNote, MoneyText, Screen, SectionHeader, StatRow, TabBar } from "@/components/ui";
import { cn } from "@/lib/cn";

/* ───────────────────────── 주(週) 계산 ───────────────────────── */

/** 이번 주 월요일(로컬) YYYY-MM-DD */
export function weekStartYmd(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7; // 월=0 … 일=6
  d.setDate(d.getDate() - offset);
  return localYmd(d);
}

/** 'YYYY-MM-DD' → 로컬 Date (시간대 밀림 없이) */
function ymdToLocalDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

/** weekStart 이후(포함) 플레이한 영수증의 시급 변동 합계와 시프트 수 */
export function summarizeWeek(sessions: ShiftSummary[], weekStart: string) {
  let wageDelta = 0;
  let shifts = 0;
  for (const s of sessions) {
    const played = new Date(s.playedAt);
    if (Number.isNaN(played.getTime())) continue;
    if (localYmd(played) >= weekStart) {
      wageDelta += s.wageDelta;
      shifts += 1;
    }
  }
  return { wageDelta, shifts };
}

/* ───────────────────────── 점장 코칭 한 줄 ───────────────────────── */

/** 하위권 판정 — 6명 이상이면 하위 5위권, 그보다 적으면 하위 25% */
export function isLowerRank(rank: number, total: number): boolean {
  if (total <= 1) return false;
  if (total >= 6) return rank > total - 5;
  return rank > total * 0.75;
}

/**
 * 하위권일 때 점장이 건네는 한 줄. 시프트 수가 적으면 출근을, 시급이 깎였으면 손님 응대를, 아니면 콤보를 짚는다.
 * 순위가 하위권이 아니거나 내 항목이 없으면 null.
 */
export function coachingLine(data: LeagueDTO): { ja: string; ko: string } | null {
  const me = data.me;
  if (!me || !isLowerRank(me.rank, data.entries.length)) return null;
  if (me.shifts < 3) {
    return { ja: "来週は朝シフトを一つだけ増やそう。", ko: "다음 주는 아침 시프트 하나만 더" };
  }
  if (me.weeklyWageDelta < 0) {
    return { ja: "客を帰すな。コンボより一人の客だ。", ko: "손님을 돌려보내지 마. 콤보보다 손님 한 명이야" };
  }
  return { ja: "コンボを一つ伸ばせば、順位は動く。", ko: "콤보 하나만 더 이으면 순위가 움직여" };
}

/* ───────────────────────── 요청 상태 ───────────────────────── */

type LeagueFetch =
  | { kind: "loading" }
  | { kind: "ready"; data: LeagueDTO }
  | { kind: "unavailable"; reason: "unconfigured" | "offline" | "error" };

function classifyError(err: unknown): "unconfigured" | "offline" | "error" {
  if (err instanceof ApiError && err.status === 503) return "unconfigured";
  if (err instanceof TypeError) return "offline";
  return "error";
}

/* ───────────────────────── 화면 ───────────────────────── */

export function LeagueScreen() {
  const hydrated = useGameStore((s) => s.hydrated);
  const profile = useGameStore((s) => s.profile);
  const sessions = useGameStore((s) => s.sessions);
  const syncStatus = useGameStore((s) => s.sync.status);

  const [fetchState, setFetchState] = useState<LeagueFetch>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // attempt 가 바뀔 때마다 다시 요청한다. 로딩 상태는 초기값과 retry 가 맡는다
  useEffect(() => {
    const controller = new AbortController();
    api
      .league()
      .then((data) => {
        if (controller.signal.aborted) return;
        setFetchState({ kind: "ready", data });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setFetchState({ kind: "unavailable", reason: classifyError(err) });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setFetchState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  // 서버 응답이 없으면 로컬 월요일 — 단, 프리렌더에 현재 시각이 들어가지 않도록 복원(hydrated) 뒤에만 계산
  const weekStart = fetchState.kind === "ready" ? fetchState.data.weekStart : hydrated ? weekStartYmd() : null;
  const weekStartDate = weekStart ? ymdToLocalDate(weekStart) : null;
  const mine = weekStart ? summarizeWeek(sessions, weekStart) : { wageDelta: 0, shifts: 0 };

  return (
    <Screen tone="surface" footer={<TabBar active="league" />}>
      <header className="flex items-end justify-between gap-3 px-screen">
        <div className="flex flex-col gap-1">
          <h1 lang="ja" className="font-jp text-title text-ink">
            時給リーグ
          </h1>
          <span className="font-ko text-caption text-ink-muted">이번 주 시급 랭킹</span>
        </div>
        <span className="flex items-center gap-1 text-[13px] font-bold text-ink-muted">
          <Icon name="calendar" size={16} />
          <span lang="ja" className="font-jp">
            {weekStartDate ? `${formatDateJa(weekStartDate)}〜` : (weekStart ?? "…")}
          </span>
        </span>
      </header>

      <div className="flex flex-col gap-6 px-screen pb-6 pt-4">
        {/* 나의 이번 주 — 로컬 영수증 기준. 서버와 무관하게 항상 보인다 */}
        {hydrated ? (
          <Card padding="lg" radius="4xl" data-testid="my-week">
            <SectionHeader title={<span lang="ja">今週のわたし</span>} aside="이번 주 나의 기록" />
            <div className="mt-3 flex flex-col gap-2">
              <StatRow
                label="시급 변동"
                value={<MoneyText yen={mine.wageDelta} delta />}
                tone={mine.wageDelta > 0 ? "perfect" : mine.wageDelta < 0 ? "irritation" : "default"}
              />
              <StatRow label="시프트" value={`${mine.shifts}회`} />
              <StatRow label="현재 시급" value={<MoneyText yen={profile.wage} />} size="lg" />
            </div>
          </Card>
        ) : (
          <MyWeekSkeleton />
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader title={<span lang="ja">ランキング</span>} aside="30명 버킷 · 시급 변동 순" />
          {fetchState.kind === "loading" ? (
            <RankingSkeleton />
          ) : fetchState.kind === "unavailable" ? (
            <UnavailableCard reason={fetchState.reason} syncStatus={syncStatus} onRetry={retry} />
          ) : (
            <RankingList data={fetchState.data} />
          )}
        </section>
      </div>
    </Screen>
  );
}

/* ───────────────────────── 순위 목록 ───────────────────────── */

function RankingList({ data }: { data: LeagueDTO }) {
  if (data.entries.length === 0) {
    return (
      <Card variant="sunken" padding="lg" className="text-center">
        <p lang="ja" className="font-jp text-bubble text-ink">
          まだ誰もいない
        </p>
        <p className="mt-1 font-ko text-caption text-ink-muted">아직 아무도 없어요. 첫 시프트를 마치면 순위가 생겨요</p>
      </Card>
    );
  }
  const coaching = coachingLine(data);
  return (
    <>
      <Card padding="none" radius="4xl" className="overflow-hidden">
        <ol className="flex flex-col divide-y divide-border">
          {data.entries.map((entry) => (
            <RankingRow key={entry.playerId} entry={entry} />
          ))}
        </ol>
      </Card>
      {coaching ? (
        <div data-testid="coaching" role="note" aria-label="점장 코칭">
          <ManagerNote ja={coaching.ja} ko={coaching.ko} />
        </div>
      ) : null}
      {data.me === null ? (
        <p className="text-center font-ko text-caption text-ink-muted">이번 주 시프트를 마치면 순위에 올라요</p>
      ) : null}
    </>
  );
}

function RankingRow({ entry }: { entry: LeagueEntryDTO }) {
  const name = entry.name.trim().length > 0 ? entry.name : "名無し";
  return (
    <li
      data-me={entry.isMe || undefined}
      aria-current={entry.isMe ? "true" : undefined}
      className={cn("flex min-h-touch items-center gap-3 px-4 py-3", entry.isMe && "bg-accent-soft")}
    >
      <span
        className={cn(
          "w-7 shrink-0 text-center font-num text-heading tabular-nums",
          entry.rank <= 3 ? "text-accent" : "text-ink-muted",
        )}
      >
        {entry.rank}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span lang="ja" className="truncate font-jp text-pos-option text-ink">
            {name}
          </span>
          {entry.isMe ? <Badge tone="accent">나</Badge> : null}
        </span>
        <span className="font-ko text-caption text-ink-muted">
          시프트 {entry.shifts}회 · 시급 <MoneyText yen={entry.wage} className="text-caption font-bold" />
        </span>
      </span>
      <MoneyText yen={entry.weeklyWageDelta} delta className="shrink-0" />
    </li>
  );
}

/* ───────────────────────── 비어 있는 상태 ───────────────────────── */

const UNAVAILABLE_KO: Record<"unconfigured" | "offline" | "error", string> = {
  unconfigured: "리그 집계는 서버 연결 후 열려요",
  offline: "지금은 오프라인이에요. 연결되면 순위를 불러올게요",
  error: "순위를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요",
};

function UnavailableCard({
  reason,
  syncStatus,
  onRetry,
}: {
  reason: "unconfigured" | "offline" | "error";
  syncStatus: string;
  onRetry: () => void;
}) {
  // 스토어가 이미 "서버 미설정"을 알고 있으면 그 문구를 우선한다
  const effective = syncStatus === "unconfigured" ? "unconfigured" : reason;
  return (
    <Card variant="sunken" padding="lg" radius="4xl" className="flex flex-col items-center gap-3 text-center" role="status">
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-surface-raised text-ink-muted shadow-hairline">
        <Icon name="trophy" size={22} />
      </span>
      <div className="flex flex-col gap-1">
        <p lang="ja" className="font-jp text-phrase-lg text-ink">
          準備中
        </p>
        <p className="font-ko text-caption text-ink-muted">{UNAVAILABLE_KO[effective]}</p>
      </div>
      {effective !== "unconfigured" ? (
        <CtaButton variant="onSurface" icon="refresh" onClick={onRetry} className="mt-1 shadow-hairline">
          다시 불러오기
        </CtaButton>
      ) : null}
    </Card>
  );
}

/* ───────────────────────── 스켈레톤 ───────────────────────── */

function RankingSkeleton() {
  return (
    <Card padding="none" radius="4xl" aria-busy="true" aria-label="순위 불러오는 중" className="overflow-hidden">
      <ul className="flex flex-col divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex min-h-touch items-center gap-3 px-4 py-3">
            <span className="size-6 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="h-3.5 w-1/2 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
              <span className="h-3 w-1/3 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
            </span>
            <span className="h-4 w-12 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MyWeekSkeleton() {
  return (
    <div aria-busy="true" aria-label="기록 불러오는 중" className="flex flex-col gap-3 rounded-4xl bg-surface-raised p-4 shadow-hairline">
      <span className="h-5 w-1/3 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
      <span className="h-4 w-full animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
      <span className="h-4 w-full animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
    </div>
  );
}
