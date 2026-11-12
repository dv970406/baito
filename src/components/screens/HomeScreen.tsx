"use client";

/**
 * 02 KONBINI 홈 · 시프트 표 (surface 톤, 탭바 "시프트").
 * 점장 메모 → 시즌 공지 → 오늘 시프트 4줄(朝·昼·夕 + 추가 근무 深夜) → 단골·승급 시험·말하기 모드 → 하단 출근 CTA.
 * 날짜·localStorage 는 클라이언트에서만 읽는다: `hydrated` 전에는 자리표시 스켈레톤.
 */
import Link from "next/link";
import {
  Badge,
  CaptionLangToggle,
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
import { dayDiff, rankAtLeast } from "@/engine/progression";
import {
  DAILY_SLOTS,
  SHIFT_SLOTS,
  type ManagerLine,
  type RankDef,
  type RankId,
  type Season,
  type ShiftConfig,
  type ShiftSlot,
  type ShiftSummary,
} from "@/engine/types";
import { isSpeakingUnlocked } from "@/components/game/shiftModel";
import { cn } from "@/lib/cn";
import { formatDateJa } from "@/lib/format";
import { isSpeechRecognitionSupported } from "@/lib/speech";
import { localYmd } from "@/store/date";
import { cap, capPair, type CaptionLang } from "@/i18n/caption";
import { translate } from "@/i18n/messages";
import { useT } from "@/i18n/useT";
import { useGameStore } from "@/store/gameStore";
import {
  selectAvailableSlots,
  selectCompletedToday,
  selectExam,
  selectNextSlot,
  selectRank,
  selectRegularsMetCount,
} from "@/store/selectors";

const RESUME_HREF = "/";
const REGULARS_HREF = "/konbini/regulars";
const EXAM_HREF = "/konbini/shift/exam";
const shiftHref = (slot: ShiftSlot) => `/konbini/shift/${slot}`;

/** 시간대별 첫인사 (다음 시프트 기준) */
const GREETING: Record<ShiftSlot, string> = {
  asa: "おはよう、",
  hiru: "お疲れ、",
  yoru: "こんばんは、",
  shinya: "こんばんは、",
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
 * 이틀 이상 비웠으면 결근 대사 → 승급 시험을 볼 수 있으면 점검 예고(exam_ready) → 셋 다 끝났으면 마감 대사 →
 * 아니면 다음 시프트 시간대의 홈 대사. 날짜 해시로 하루 한 줄 고정.
 */
export function pickManagerLine(
  lines: ManagerLine[],
  opts: {
    today: string;
    lastPlayDate: string | null;
    nextSlot: ShiftSlot | null;
    /** 승급 시험(점장 점검)을 지금 볼 수 있는가 */
    examAvailable?: boolean;
  },
): ManagerLine | null {
  const { today, lastPlayDate, nextSlot, examAvailable = false } = opts;
  const absent = lastPlayDate !== null && dayDiff(lastPlayDate, today) >= 2;

  let pool: ManagerLine[] = [];
  if (absent) {
    pool = lines.filter((l) => l.when === "absent");
  }
  if (pool.length === 0 && examAvailable) {
    pool = lines.filter((l) => l.when === "exam_ready");
  }
  if (pool.length > 0) {
    // 결근·점검 대사는 시간대와 무관
  } else if (nextSlot === null) {
    pool = lines.filter((l) => l.when === "shift_end_good");
  } else {
    pool = lines.filter((l) => l.when === "home" && l.slot === nextSlot);
    if (pool.length === 0) pool = lines.filter((l) => l.when === "home");
  }
  if (pool.length === 0) return null;
  return pool[hashString(`${today}:${nextSlot ?? "closed"}`) % pool.length];
}

/** 이번 달 시즌 공지. 시즌이 없거나 noticeJa 가 없으면 null (빈 배열에서도 안전) */
export function pickSeasonNotice(seasons: Season[], month: number): Season | null {
  const season = seasons.find((s) => s.month === month);
  if (!season || !season.noticeJa) return null;
  return season;
}

/**
 * 추가 시프트(심야)가 잠긴 이유 문구. 직급이 모자라면 「先輩から」, 직급은 됐지만 기본 시프트가 남았으면 "세 시프트 후".
 */
export function optionalLockReason(
  config: ShiftConfig,
  rankId: RankId,
  ranks: RankDef[],
  lang: CaptionLang = "ko",
): { ja: string; ko: string } {
  const required = config.requiredRank ? ranks.find((r) => r.id === config.requiredRank) : null;
  if (required && !rankAtLeast(rankId, required.id, ranks)) {
    return { ja: `${required.ja}から`, ko: translate(lang, "home.lockRank", { rank: cap(required, lang) }) };
  }
  return { ja: "", ko: translate(lang, "home.lockAfterDaily", { n: DAILY_SLOTS.length }) };
}

/** 오늘 그 시간대에 끝낸 영수증(가장 최근) */
function findTodaySession(
  sessions: ShiftSummary[],
  slot: ShiftSlot,
  today: string,
): ShiftSummary | undefined {
  return sessions.find((s) => {
    if (s.slot !== slot || s.workplaceId !== konbini.id) return false;
    // 승급 시험은 시간대 설정만 빌린 추가 근무 — 시프트 표 기록에 섞지 않는다
    if (s.exam) return false;
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
  /** 잠김 이유(추가 시프트). 없으면 "이전 시프트 후 열림" */
  lockReason?: { ja: string; ko: string };
}

function ShiftRow({ slot, state, session, lockReason }: ShiftRowProps) {
  const { t, lang } = useT();
  const cfg = konbiniShifts[slot];
  const name = capPair(cfg.nameKo, cfg.nameEn, lang);
  const shiftLabel = t("common.shiftName", { name });
  const title = `${name} · ${cfg.hours}`;
  const prevSlot = DAILY_SLOTS[DAILY_SLOTS.indexOf(slot) - 1];

  if (state === "next") {
    return (
      <Card
        as="link"
        href={shiftHref(slot)}
        variant="accent"
        padding="md"
        aria-label={t("home.clockInShift", { name, hours: cfg.hours })}
      >
        <div className="flex items-center gap-3.5">
          <KanjiBadge
            kanji={cfg.kanji}
            tone="ghost"
            size="lg"
            label={shiftLabel}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-jp text-pos-option text-brand-ink">
              {title}
            </span>
            <span className="text-caption text-accent-soft">
              {capPair(cfg.descriptionKo, cfg.descriptionEn, lang)}
            </span>
          </div>
          <span className="shrink-0 rounded-pill bg-surface-raised px-3 py-2 font-jp text-[13px] font-extrabold text-accent">
            {t("home.clockIn")}
          </span>
        </div>
      </Card>
    );
  }

  if (state === "completed") {
    const detail = session
      ? t("home.doneDetail", { served: session.served, combo: session.maxCombo })
      : t("common.done");
    return (
      <Card variant="raised" padding="md" data-state="completed">
        <div className="flex items-center gap-3.5">
          <KanjiBadge
            kanji={cfg.kanji}
            tone="perfect"
            size="lg"
            label={shiftLabel}
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
            label={t("common.done")}
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
          label={shiftLabel}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-jp text-pos-option text-ink">{title}</span>
          {locked ? (
            <span className="text-caption text-ink-muted">
              {lockReason ? (
                <>
                  {lockReason.ja ? (
                    <>
                      <span lang="ja" className="font-jp">
                        {lockReason.ja}
                      </span>
                      {" · "}
                    </>
                  ) : null}
                  {lockReason.ko}
                </>
              ) : prevSlot ? (
                t("home.opensAfter", { name: capPair(konbiniShifts[prevSlot].nameKo, konbiniShifts[prevSlot].nameEn, lang) })
              ) : (
                t("home.previousFirst")
              )}
            </span>
          ) : (
            <Skel className="h-3 w-28" />
          )}
        </div>
        {locked ? (
          <Icon name="lock" size={20} label={t("common.locked")} className="text-ink-faint" />
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
  const { t, lang } = useT();

  // 날짜는 세이브 복원 뒤(클라이언트)에서만 읽는다 — 서버 렌더와 첫 클라이언트 렌더는 스켈레톤으로 일치
  const ready = hydrated;
  const today = ready ? localYmd() : null;

  const rank = selectRank(profile, konbiniRanks);
  const completed = today ? selectCompletedToday(profile, today) : [];
  const nextSlot = today ? selectNextSlot(profile, today) : null;
  const available = today ? selectAvailableSlots(profile, today, { shifts: konbiniShifts, ranks: konbiniRanks }) : [];
  const allDone = ready && nextSlot === null;
  const regularsMet = selectRegularsMetCount(profile);
  const regularsTotal = konbini.regulars.length;

  // 추가 시프트(심야): 기본 3개를 끝내고 직급 조건을 채우면 열린다
  const shinyaCfg = konbiniShifts.shinya;
  const shinyaOpen = ready && available.includes("shinya") && !completed.includes("shinya");
  const shinyaLock = ready && !available.includes("shinya") ? optionalLockReason(shinyaCfg, profile.rank, konbiniRanks, lang) : undefined;

  // 승급 시험(점장 점검) — 주 1회
  const exam = today ? selectExam(profile, konbiniRanks, today) : null;
  const examAvailable = Boolean(exam?.available);

  // 이번 달 시즌 공지 — 달도 복원 뒤 클라이언트에서만
  const seasonNotice = ready ? pickSeasonNotice(konbini.seasons, new Date().getMonth() + 1) : null;

  // 날짜 해시로 뽑으므로 렌더마다 같은 줄 — 메모 불필요
  const managerLine = today
    ? pickManagerLine(konbiniManager, {
        today,
        lastPlayDate: profile.lastPlayDate,
        nextSlot,
        examAvailable,
      })
    : null;

  // 말하기 모드: 선배부터 전 시프트, 夕(레벨 3) 시프트는 직급과 무관하게. 브라우저 지원은 복원 뒤에만 판단
  const speakingAll = ready && isSpeakingUnlocked(profile, konbiniShifts.asa, konbiniRanks);
  const speakingSupported = ready ? isSpeechRecognitionSupported() : true;
  const speakingLocked = !speakingAll;
  const speakingCaption = !speakingSupported
    ? t("home.speakUnsupported")
    : speakingAll
      ? t("home.speakReady")
      : t("home.speakLocked");

  const rowState = (slot: ShiftSlot): ShiftRowState => {
    if (!ready) return "pending";
    if (completed.includes(slot)) return "completed";
    if (slot === nextSlot) return "next";
    if (konbiniShifts[slot].optional && available.includes(slot)) return "next";
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[13px] font-medium text-ink-muted">
              {today ? formatDateJa(new Date()) : <Skel className="h-3.5 w-24" />}
            </span>
            <CaptionLangToggle />
          </div>
          <h1 className="font-jp text-title text-ink">
            <span lang="ja">{greeting}</span>
            <br />
            {ready ? t("home.employee", { name: profile.name }) : <Skel className="h-7 w-32" />}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={RESUME_HREF}
            aria-label={t("home.switchJob")}
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
            <span className="text-label text-ink-muted">{t("common.streak")}</span>
          </div>
        </div>
      </header>

      {/* 직급 / 시급 */}
      <section aria-label={t("home.rankAndWage")} className="mt-4 px-screen">
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
                      {cap(rank.current, lang)}
                      {" · "}
                      {rank.next
                        ? rank.examReady
                          ? t("home.examPending")
                          : t("home.toPromotion", { n: rank.shiftsToNext })
                        : t("common.topRank")}
                    </span>
                  </>
                ) : (
                  <Skel onShell className="h-5 w-36" />
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-label text-shell-muted">{t("common.wage")}</span>
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
      <section aria-label={t("home.managerMemo")} className="mt-4 px-screen">
        {managerLine ? (
          <ManagerNote ja={managerLine.ja} ko={cap(managerLine, lang)} />
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl bg-tip-soft px-3.5 py-3">
            <KanjiBadge
              kanji="店長"
              tone="tip"
              label={t("common.manager")}
              className="text-[11px]"
            />
            <div className="flex flex-col gap-1.5 pt-0.5">
              <Skel className="h-3.5 w-44" />
              <Skel className="h-3 w-28" />
            </div>
          </div>
        )}
      </section>

      {/* 시즌 공지 — 이번 달 규칙 변경 */}
      {seasonNotice ? (
        <section aria-label={t("home.monthNotice")} className="mt-2.5 px-screen">
          <Card variant="raised" padding="md" radius="2xl" data-testid="season-notice">
            <div className="flex items-start gap-2.5">
              <KanjiBadge kanji="告" tone="accent" label={t("home.notice")} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-jp text-label text-accent">
                  今月のお知らせ · <span lang="ja">{seasonNotice.nameJa}</span>
                </span>
                <span lang="ja" className="font-jp text-bubble text-ink">
                  {seasonNotice.noticeJa}
                </span>
                {seasonNotice.noticeKo || seasonNotice.noticeEn ? (
                  <span className="font-ko text-caption text-ink-muted">
                    {capPair(seasonNotice.noticeKo ?? "", seasonNotice.noticeEn, lang)}
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {/* 오늘 시프트 */}
      <section aria-labelledby="shifts-heading" className="mt-6 px-screen">
        <SectionHeader
          title={<span id="shifts-heading">{t("home.todayShifts")}</span>}
          aside={allDone ? t("home.fullShiftDone") : t("home.fullShiftHint")}
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
                lockReason={slot === "shinya" ? shinyaLock : undefined}
              />
            </li>
          ))}
        </ul>
        {allDone && !shinyaOpen ? (
          <Card variant="sunken" padding="md" className="mt-2.5">
            <div className="flex flex-col gap-1">
              <span lang="ja" className="font-jp text-pos-option text-ink">
                本日は閉店。
              </span>
              <span className="text-caption text-ink-muted">
                {t("home.closedTodayBody")}
              </span>
            </div>
          </Card>
        ) : null}
      </section>

      {/* 단골 · 직급 · 말하기 모드 */}
      <section aria-labelledby="meta-heading" className="mt-6 px-screen pb-6">
        <SectionHeader
          title={<span id="meta-heading">{t("home.regulars")}</span>}
          aside={t("home.album")}
          href={REGULARS_HREF}
          asideLabel={t("home.toAlbum")}
        />
        <div className="mt-3 flex flex-col gap-2.5">
          <Card
            as="link"
            href={REGULARS_HREF}
            variant="raised"
            padding="md"
            aria-label={t("home.viewAlbum")}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-jp text-pos-option text-ink">
                  {t("home.metRegulars")}
                </span>
                <span className="text-caption text-ink-muted">
                  {t("home.metRegularsCaption")}
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

          {exam && exam.available && exam.target && exam.rule ? (
            <Card
              as="link"
              href={EXAM_HREF}
              variant="accent"
              padding="md"
              aria-label={t("home.examCardAria", { rank: cap(exam.target, lang) })}
              data-testid="exam-card"
            >
              <div className="flex items-center gap-3.5">
                <KanjiBadge kanji="点検" tone="ghost" size="lg" label={t("home.examCheck")} className="text-[15px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-jp text-pos-option text-brand-ink">
                    <span lang="ja">店長点検</span> · <span lang="ja">{exam.target.ja}</span> {cap(exam.target, lang)}
                  </span>
                  <span className="text-caption text-accent-soft">
                    {t("home.examRule", { kanji: konbiniShifts[exam.rule.slot].kanji, combo: exam.rule.combo })}
                  </span>
                </div>
                <span className="shrink-0 rounded-pill bg-surface-raised px-3 py-2 font-jp text-[13px] font-extrabold text-accent">
                  {t("home.clockIn")}
                </span>
              </div>
            </Card>
          ) : exam && exam.ready && exam.takenThisWeek && exam.target ? (
            <Card variant="sunken" dashed padding="md" aria-disabled="true" data-testid="exam-card" data-taken="true">
              <div className="flex items-center gap-3.5">
                <KanjiBadge kanji="点検" tone="sunken" size="lg" label={t("home.examCheck")} className="text-[15px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-jp text-pos-option text-ink-muted">
                    <span lang="ja">店長点検</span> · <span lang="ja">{exam.target.ja}</span> {cap(exam.target, lang)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                    <Icon name="lock" size={14} />
                    {t("home.examTaken")}
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            <Card variant="raised" padding="md">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-jp text-pos-option text-ink">
                    {rank.next ? (
                      <>
                        {t("home.nextRank")} <span lang="ja">{rank.next.ja}</span> ·{" "}
                        {cap(rank.next, lang)}
                      </>
                    ) : (
                      <>
                        <span lang="ja">{rank.current.ja}</span> · {t("common.topRank")}
                      </>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-caption text-ink-muted">
                    {ready
                      ? rank.next
                        ? t("home.remaining", { n: rank.shiftsToNext })
                        : t("home.achieved")
                      : "—"}
                  </span>
                </div>
                <ProgressBar
                  value={ready ? rank.progress : 0}
                  tone="accent"
                  label={t("home.nextRankProgress")}
                />
              </div>
            </Card>
          )}

          <Card
            variant={speakingLocked ? "sunken" : "raised"}
            dashed={speakingLocked}
            padding="md"
            aria-disabled={speakingLocked ? "true" : undefined}
            data-locked={speakingLocked}
          >
            <div className="flex items-center gap-3.5">
              <span
                className={cn(
                  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg",
                  speakingLocked ? "bg-border text-ink-muted" : "bg-accent-soft text-accent",
                )}
              >
                <Icon name="mic" size={22} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("font-jp text-pos-option", speakingLocked ? "text-ink-muted" : "text-ink")}>
                  <span lang="ja">話す</span> · {t("home.speakingMode")}
                </span>
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  {speakingLocked ? <Icon name="lock" size={14} /> : null}
                  {speakingCaption}
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
              {t("home.ctaClockIn")} · {nextCfg.kanji}
            </CtaButton>
          ) : shinyaOpen ? (
            <CtaButton as="link" href={shiftHref("shinya")} variant="primary" icon="play">
              <span lang="ja">深夜</span> {t("home.ctaShinya")} · {shinyaCfg.kanji}
            </CtaButton>
          ) : (
            <CtaButton variant="primary" disabled icon="play">
              {allDone ? t("home.closedToday") : t("home.ctaClockIn")}
            </CtaButton>
          )}
        </div>
        <TabBar active="shift" />
      </div>
    </Screen>
  );
}
