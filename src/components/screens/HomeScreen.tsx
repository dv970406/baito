"use client";

/**
 * 02 KONBINI 홈 · 시프트 표 (surface 톤, 탭바 "시프트").
 * 점장 메모 → 오늘 시프트 3줄(완료/출근/잠김) → 단골·직급·말하기 모드 → 하단 출근 CTA.
 * 날짜·localStorage 는 클라이언트에서만 읽는다: `hydrated` 전에는 자리표시 스켈레톤.
 */
import Link from "next/link";
import {
  Badge,
  Card,
  CtaButton,
  Icon,
  KanjiBadge,
  ManagerNote,
  MoneyText,
  ProgressBar,
  Screen,
  SectionHeader,
  TabBar,
} from "@/components/ui";
import { konbini } from "@/content";
import { konbiniManager } from "@/content/konbini/manager";
import { konbiniRanks, konbiniShifts } from "@/content/konbini/shifts";
import { dayDiff } from "@/engine/progression";
import {
  SHIFT_SLOTS,
  type ManagerLine,
  type ShiftSlot,
  type ShiftSummary,
} from "@/engine/types";
import { cn } from "@/lib/cn";
import { formatDateJa } from "@/lib/format";
import { localYmd } from "@/store/date";
import { useGameStore } from "@/store/gameStore";
import {
  selectCompletedToday,
  selectNextSlot,
  selectRank,
  selectRegularsMetCount,
} from "@/store/selectors";

const RESUME_HREF = "/";
const REGULARS_HREF = "/konbini/regulars";
const shiftHref = (slot: ShiftSlot) => `/konbini/shift/${slot}`;

/** 시간대별 첫인사 (다음 시프트 기준) */
const GREETING: Record<ShiftSlot, string> = {
  asa: "おはよう、",
  hiru: "お疲れ、",
  yoru: "こんばんは、",
};

/* ───────────────────────── 순수 헬퍼 ───────────────────────── */

/** 문자열 → 안정적인 정수 해시 (하루 동안 같은 대사가 나오게) */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * 오늘의 점장 메모.
 * 이틀 이상 비웠으면 결근 대사, 아니면 다음 시프트 시간대의 홈 대사. 날짜 해시로 하루 한 줄 고정.
 */
export function pickManagerLine(
  lines: ManagerLine[],
  opts: {
    today: string;
    lastPlayDate: string | null;
    nextSlot: ShiftSlot | null;
  },
): ManagerLine | null {
  const { today, lastPlayDate, nextSlot } = opts;
  const absent = lastPlayDate !== null && dayDiff(lastPlayDate, today) >= 2;

  let pool: ManagerLine[];
  if (nextSlot === null) {
    pool = lines.filter((l) => l.when === "shift_end_good");
  } else if (absent) {
    pool = lines.filter((l) => l.when === "absent");
  } else {
    pool = lines.filter((l) => l.when === "home" && l.slot === nextSlot);
    if (pool.length === 0) pool = lines.filter((l) => l.when === "home");
  }
  if (pool.length === 0) return null;
  return pool[hashString(`${today}:${nextSlot ?? "closed"}`) % pool.length];
}

/** 오늘 그 시간대에 끝낸 영수증(가장 최근) */
function findTodaySession(
  sessions: ShiftSummary[],
  slot: ShiftSlot,
  today: string,
): ShiftSummary | undefined {
  return sessions.find((s) => {
    if (s.slot !== slot || s.workplaceId !== konbini.id) return false;
    const d = new Date(s.playedAt);
    return !Number.isNaN(d.getTime()) && localYmd(d) === today;
  });
}

/** 스켈레톤 자리표시 막대 */
function Skel({
  className,
  onShell = false,
}: {
  className?: string;
  onShell?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-pulse rounded-sm motion-reduce:animate-none",
        onShell ? "bg-shell-border" : "bg-border",
        className,
      )}
    />
  );
}

/* ───────────────────────── 시프트 행 ───────────────────────── */

type ShiftRowState = "completed" | "next" | "locked" | "pending";

interface ShiftRowProps {
  slot: ShiftSlot;
  state: ShiftRowState;
  /** 완료 행의 영수증 요약 */
  session?: ShiftSummary;
}

function ShiftRow({ slot, state, session }: ShiftRowProps) {
  const cfg = konbiniShifts[slot];
  const title = `${cfg.nameKo} · ${cfg.hours}`;
  const prevSlot = SHIFT_SLOTS[SHIFT_SLOTS.indexOf(slot) - 1];

  if (state === "next") {
    return (
      <Card
        as="link"
        href={shiftHref(slot)}
        variant="accent"
        padding="md"
        aria-label={`${cfg.nameKo} 시프트 출근 · ${cfg.hours}`}
      >
        <div className="flex items-center gap-3.5">
          <KanjiBadge
            kanji={cfg.kanji}
            tone="ghost"
            size="lg"
            label={`${cfg.nameKo} 시프트`}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-jp text-pos-option text-brand-ink">
              {title}
            </span>
            <span className="text-caption text-accent-soft">
              {cfg.descriptionKo}
            </span>
          </div>
          <span className="shrink-0 rounded-pill bg-surface-raised px-3 py-2 font-jp text-[13px] font-extrabold text-accent">
            출근
          </span>
        </div>
      </Card>
    );
  }

  if (state === "completed") {
    const detail = session
      ? `완료 · 손님 ${session.served}명 · 최고 콤보 ×${session.maxCombo}`
      : "완료";
    return (
      <Card variant="raised" padding="md" data-state="completed">
        <div className="flex items-center gap-3.5">
          <KanjiBadge
            kanji={cfg.kanji}
            tone="perfect"
            size="lg"
            label={`${cfg.nameKo} 시프트`}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-jp text-pos-option text-ink-muted">
              {title}
            </span>
            <span className="text-caption text-ink-muted">{detail}</span>
          </div>
          <Icon
            name="check"
            size={22}
            strokeWidth={2.5}
            label="완료"
            className="text-perfect"
          />
        </div>
      </Card>
    );
  }

  // locked · pending(스켈레톤)
  const locked = state === "locked";
  return (
    <Card
      variant="raised"
      padding="md"
      className={cn(locked && "opacity-70")}
      data-state={state}
      aria-disabled={locked || undefined}
    >
      <div className="flex items-center gap-3.5">
        <KanjiBadge
          kanji={cfg.kanji}
          tone="sunken"
          size="lg"
          label={`${cfg.nameKo} 시프트`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-jp text-pos-option text-ink">{title}</span>
          {locked ? (
            <span className="text-caption text-ink-muted">
              {prevSlot
                ? `${konbiniShifts[prevSlot].nameKo} 시프트 후 열림`
                : "이전 시프트 먼저"}
            </span>
          ) : (
            <Skel className="h-3 w-28" />
          )}
        </div>
        {locked ? (
          <Icon name="lock" size={20} label="잠김" className="text-ink-faint" />
        ) : (
          <Skel className="size-5" />
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────── 화면 ───────────────────────── */

export function HomeScreen() {
  const hydrated = useGameStore((s) => s.hydrated);
  const profile = useGameStore((s) => s.profile);
  const sessions = useGameStore((s) => s.sessions);

  // 날짜는 세이브 복원 뒤(클라이언트)에서만 읽는다 — 서버 렌더와 첫 클라이언트 렌더는 스켈레톤으로 일치
  const ready = hydrated;
  const today = ready ? localYmd() : null;

  const rank = selectRank(profile, konbiniRanks);
  const completed = today ? selectCompletedToday(profile, today) : [];
  const nextSlot = today ? selectNextSlot(profile, today) : null;
  const allDone = ready && nextSlot === null;
  const regularsMet = selectRegularsMetCount(profile);
  const regularsTotal = konbini.regulars.length;

  // 날짜 해시로 뽑으므로 렌더마다 같은 줄 — 메모 불필요
  const managerLine = today
    ? pickManagerLine(konbiniManager, {
        today,
        lastPlayDate: profile.lastPlayDate,
        nextSlot,
      })
    : null;

  const senpaiIdx = konbiniRanks.findIndex((r) => r.id === "senpai");
  const rankIdx = konbiniRanks.findIndex((r) => r.id === rank.current.id);
  const speakingLocked = rankIdx < senpaiIdx;

  const rowState = (slot: ShiftSlot): ShiftRowState => {
    if (!ready) return "pending";
    if (completed.includes(slot)) return "completed";
    if (slot === nextSlot) return "next";
    return "locked";
  };

  const greeting = nextSlot ? GREETING[nextSlot] : "お疲れ様、";
  const nextCfg = nextSlot ? konbiniShifts[nextSlot] : null;

  return (
    <Screen tone="surface" workplace="konbini">
      {/* 헤더 */}
      <header
        aria-busy={!ready || undefined}
        className="flex items-start justify-between gap-3 px-screen pt-1"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-medium text-ink-muted">
            {today ? formatDateJa(new Date()) : <Skel className="h-3.5 w-24" />}
          </span>
          <h1 className="font-jp text-title text-ink">
            <span lang="ja">{greeting}</span>
            <br />
            {ready ? `${profile.name} 알바생` : <Skel className="h-7 w-32" />}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={RESUME_HREF}
            aria-label="직장 바꾸기 · BAITO 이력서"
            className="inline-flex min-h-touch items-center gap-1.5 rounded-pill bg-shell py-1.5 pl-1.5 pr-2.5 font-jp text-label text-brand-ink"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-sm bg-accent text-[11px] font-extrabold tracking-normal"
            >
              バ
            </span>
            {konbini.code}
            <Icon name="chevronDown" size={14} strokeWidth={3} />
          </Link>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface-raised px-3 py-2 shadow-hairline">
            {ready ? (
              <span className="font-num text-money-lg leading-none text-accent">
                {profile.streak}
              </span>
            ) : (
              <Skel className="h-6 w-8" />
            )}
            <span className="text-label text-ink-muted">연속 출근</span>
          </div>
        </div>
      </header>

      {/* 직급 / 시급 */}
      <section aria-label="직급과 시급" className="mt-4 px-screen">
        <Card variant="shell" radius="3xl" padding="md" className="bg-shell">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-label text-shell-muted">
                BAITO › {konbini.code} · {konbini.storeNameJa}{" "}
                {konbini.storeBranchJa}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {ready ? (
                  <>
                    <Badge tone="accent" size="md">
                      <span lang="ja">{rank.current.ja}</span>
                    </Badge>
                    <span className="font-jp text-money text-shell-ink">
                      {rank.current.ko}
                      {rank.next
                        ? ` · 승급까지 ${rank.shiftsToNext}회`
                        : " · 최고 직급"}
                    </span>
                  </>
                ) : (
                  <Skel onShell className="h-5 w-36" />
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-label text-shell-muted">시급</span>
              {ready ? (
                <MoneyText
                  yen={profile.wage}
                  size="money-lg"
                  className="text-register-glow"
                />
              ) : (
                <Skel onShell className="mt-1 h-5 w-16" />
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* 점장 메모 */}
      <section aria-label="점장 메모" className="mt-4 px-screen">
        {managerLine ? (
          <ManagerNote ja={managerLine.ja} ko={managerLine.ko} />
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl bg-tip-soft px-3.5 py-3">
            <KanjiBadge
              kanji="店長"
              tone="tip"
              label="점장"
              className="text-[11px]"
            />
            <div className="flex flex-col gap-1.5 pt-0.5">
              <Skel className="h-3.5 w-44" />
              <Skel className="h-3 w-28" />
            </div>
          </div>
        )}
      </section>

      {/* 오늘 시프트 */}
      <section aria-labelledby="shifts-heading" className="mt-6 px-screen">
        <SectionHeader
          title={<span id="shifts-heading">오늘 시프트</span>}
          aside={allDone ? "フルシフト 달성" : "3개 다 하면 フルシフト 보너스"}
        />
        <ul className="mt-3 flex flex-col gap-2.5">
          {SHIFT_SLOTS.map((slot) => (
            <li key={slot}>
              <ShiftRow
                slot={slot}
                state={rowState(slot)}
                session={
                  today ? findTodaySession(sessions, slot, today) : undefined
                }
              />
            </li>
          ))}
        </ul>
        {allDone ? (
          <Card variant="sunken" padding="md" className="mt-2.5">
            <div className="flex flex-col gap-1">
              <span lang="ja" className="font-jp text-pos-option text-ink">
                本日は閉店。
              </span>
              <span className="text-caption text-ink-muted">
                오늘 마감 — 내일 또 봐요
              </span>
            </div>
          </Card>
        ) : null}
      </section>

      {/* 단골 · 직급 · 말하기 모드 */}
      <section aria-labelledby="meta-heading" className="mt-6 px-screen pb-6">
        <SectionHeader
          title={<span id="meta-heading">단골</span>}
          aside="도감"
          href={REGULARS_HREF}
          asideLabel="단골 도감으로"
        />
        <div className="mt-3 flex flex-col gap-2.5">
          <Card
            as="link"
            href={REGULARS_HREF}
            variant="raised"
            padding="md"
            aria-label="단골 도감 보기"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-jp text-pos-option text-ink">
                  만난 단골
                </span>
                <span className="text-caption text-ink-muted">
                  얼굴을 익힌 손님 수
                </span>
              </div>
              <span className="font-num text-money text-ink">
                {ready ? regularsMet : "—"}
                <span className="text-caption font-bold text-ink-muted">
                  {" "}
                  / {regularsTotal}
                </span>
              </span>
            </div>
          </Card>

          <Card variant="raised" padding="md">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-jp text-pos-option text-ink">
                  {rank.next ? (
                    <>
                      다음 직급 <span lang="ja">{rank.next.ja}</span> ·{" "}
                      {rank.next.ko}
                    </>
                  ) : (
                    <>
                      <span lang="ja">{rank.current.ja}</span> · 최고 직급
                    </>
                  )}
                </span>
                <span className="whitespace-nowrap text-caption text-ink-muted">
                  {ready
                    ? rank.next
                      ? `${rank.shiftsToNext}회 남음`
                      : "달성"
                    : "—"}
                </span>
              </div>
              <ProgressBar
                value={ready ? rank.progress : 0}
                tone="accent"
                label="다음 직급까지 진행"
              />
            </div>
          </Card>

          <Card
            variant="sunken"
            dashed
            padding="md"
            aria-disabled="true"
            data-locked={speakingLocked}
          >
            <div className="flex items-center gap-3.5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-border text-ink-muted">
                <Icon name="mic" size={22} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-jp text-pos-option text-ink-muted">
                  <span lang="ja">話す</span> · 말하기 모드
                </span>
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  <Icon name="lock" size={14} />
                  {speakingLocked ? "선배부터" : "준비 중"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 하단 CTA + 탭바 (스크롤해도 바닥에 붙는다) */}
      <div className="sticky bottom-0 z-10 mt-auto">
        <div className="bg-surface px-screen pb-3 pt-2">
          {ready && nextSlot && nextCfg ? (
            <CtaButton
              as="link"
              href={shiftHref(nextSlot)}
              variant="primary"
              icon="play"
            >
              출근하기 · {nextCfg.kanji}
            </CtaButton>
          ) : (
            <CtaButton variant="primary" disabled icon="play">
              {allDone ? "오늘 마감" : "출근하기"}
            </CtaButton>
          )}
        </div>
        <TabBar active="shift" />
      </div>
    </Screen>
  );
}
