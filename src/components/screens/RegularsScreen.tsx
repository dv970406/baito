"use client";

/**
 * 04 단골 도감(常連図鑑).
 * 만난 단골은 상세 카드(아코디언)로, 아직 못 만난 손님은 3열 그리드(실루엣·잠김)로 보여준다.
 * "처음 들은 말" 문장 카드는 길게 누르면(500ms) 한국어 번역과 단어 분해 한 줄이 펼쳐진다 — 찾는 사람에게만 보이는 설명.
 * 보이는 숫자는 만남 횟수·호감도뿐 — 학습 지표는 어디에도 없다.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CustomerReply, Phrase, Regular, ShiftSlot } from "@/engine/types";
import { AFFINITY_MAX, isRegularUnlocked } from "@/engine/progression";
import { konbini } from "@/content";
import type { RegularState } from "@/shared/player";
import { useGameStore } from "@/store/gameStore";
import { selectAvailableSlots, selectRegularsMetCount } from "@/store/selectors";
import { Avatar, Badge, Card, Chip, Icon, LockedCard, Screen, SectionHeader, TabBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/format";
import { cap, capPair, type CaptionLang } from "@/i18n/caption";
import { translate, type MessageKey, type TFunction } from "@/i18n/messages";
import { useT } from "@/i18n/useT";

/* ───────────────────────── 필터 ───────────────────────── */

type FilterKey = "all" | "met" | "unmet" | ShiftSlot;

const FILTER_KEYS: readonly FilterKey[] = ["all", "met", "unmet", "asa", "hiru", "yoru", "shinya"];
const FILTER_MESSAGE: Partial<Record<FilterKey, MessageKey>> = {
  all: "regulars.filter.all",
  met: "regulars.filter.met",
  unmet: "regulars.filter.unmet",
};

/** 필터 칩 문구 — 상태 필터는 사전, 시간대 필터는 「朝 아침」(자막 언어) */
function filterLabel(key: FilterKey, t: TFunction, lang: CaptionLang): string {
  const message = FILTER_MESSAGE[key];
  if (message) return t(message);
  const cfg = konbini.shifts[key as ShiftSlot];
  return `${cfg.kanji} ${capPair(cfg.nameKo, cfg.nameEn, lang)}`;
}

/** 잠긴 단골의 해금 조건 — 콘텐츠 라벨(영어는 labelEn), 영어가 없으면 구조로 만든다 */
export function unlockHint(regular: Regular, lang: CaptionLang = "ko"): string | null {
  const unlock = regular.unlock;
  if (unlock.type === "open") return null;
  if (lang === "ko" || unlock.labelEn) return capPair(unlock.label, unlock.labelEn, lang);
  switch (unlock.type) {
    case "slot": {
      const cfg = konbini.shifts[unlock.slot];
      return translate(lang, "regulars.unlockSlot", { name: capPair(cfg.nameKo, cfg.nameEn, lang) });
    }
    case "rank": {
      const rank = konbini.ranks.find((r) => r.id === unlock.rank);
      return translate(lang, "regulars.unlockRank", { rank: rank ? cap(rank, lang) : unlock.rank });
    }
    case "season":
      return translate(lang, "regulars.unlockSeason", { month: formatMonth(unlock.month, lang) });
  }
}

/** 길게 누르기 판정 시간(ms) */
export const LONG_PRESS_MS = 500;

/** 도감에서 레귤러 한 명이 놓이는 상태 */
type EntryStatus = "met" | "unmet" | "locked";

interface Entry {
  regular: Regular;
  state: RegularState;
  status: EntryStatus;
}

const EMPTY_STATE: RegularState = { affinity: 0, metCount: 0, lastMetDate: null, firstWordsHeard: [] };

/** 레귤러의 대표 시간대(첫 슬롯) 한자·한국어 */
function slotMeta(regular: Regular, lang: CaptionLang = "ko") {
  const slot = regular.slots[0] ?? "asa";
  const cfg = konbini.shifts[slot];
  return { kanji: cfg.kanji, name: capPair(cfg.nameKo, cfg.nameEn, lang) };
}

/** "처음 들은 말"과 같은 일본어의 접객 문구 — 있으면 읽기·단어 분해를 빌려 쓴다 */
export function findPhraseFor(word: CustomerReply, phrases: Phrase[]): Phrase | undefined {
  return phrases.find((p) => p.ja === word.ja);
}

/** 시즌 한정 단골의 "N월 한정" 배지 문구. 시즌 해금이 아니면 null */
export function seasonBadge(regular: Regular, lang: CaptionLang = "ko"): string | null {
  return regular.unlock.type === "season"
    ? translate(lang, "regulars.seasonOnly", { month: formatMonth(regular.unlock.month, lang) })
    : null;
}

/** 현재 호감도에서 열린 가장 높은 대사. 아직 아무 대사도 못 열었으면 첫 줄 */
function currentLine(regular: Regular, affinity: number) {
  const sorted = regular.lines.slice().sort((a, b) => a.affinity - b.affinity);
  let found = sorted[0];
  for (const line of sorted) {
    if (line.affinity <= affinity) found = line;
  }
  return found;
}

/* ───────────────────────── 화면 ───────────────────────── */

export function RegularsScreen() {
  const hydrated = useGameStore((s) => s.hydrated);
  const profile = useGameStore((s) => s.profile);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { t, lang } = useT();
  // 달은 복원 뒤 클라이언트에서만 읽는다(시즌 한정 단골의 잠김 표시) — hydrated 는 클라이언트 효과 뒤에만 true
  const month = hydrated ? new Date().getMonth() + 1 : null;

  const regulars = konbini.regulars;
  const total = regulars.length;
  const metCount = selectRegularsMetCount(profile);

  const entries = useMemo<Entry[]>(() => {
    if (!hydrated || month === null) return [];
    const rank = profile.rank;
    const slots = selectAvailableSlots(profile, undefined, { shifts: konbini.shifts, ranks: konbini.ranks });
    return regulars.map((regular) => {
      const state = profile.regulars[regular.id] ?? EMPTY_STATE;
      if (state.metCount > 0) return { regular, state, status: "met" as const };
      // 시간대 조건은 "오늘 들어갈 수 있는 시프트" 중 하나라도 맞으면 열린 것으로 본다
      const unlocked = slots.some((slot) =>
        isRegularUnlocked(regular, { rank, slot, month, ranks: konbini.ranks }),
      );
      return { regular, state, status: unlocked ? ("unmet" as const) : ("locked" as const) };
    });
  }, [hydrated, month, profile, regulars]);

  const visible = entries.filter((e) => {
    switch (filter) {
      case "all":
        return true;
      case "met":
        return e.status === "met";
      case "unmet":
        return e.status !== "met";
      default:
        return e.regular.slots.includes(filter);
    }
  });
  const metEntries = visible.filter((e) => e.status === "met");
  const otherEntries = visible.filter((e) => e.status !== "met");

  return (
    <Screen tone="surface" footer={<TabBar active="regulars" />}>
      <header className="flex items-end justify-between gap-3 px-screen">
        <div className="flex flex-col gap-1">
          <h1 lang="ja" className="font-jp text-title text-ink">
            常連図鑑
          </h1>
          <span className="font-ko text-caption text-ink-muted">{t("regulars.title")}</span>
        </div>
        <span className="text-[13px] font-bold text-ink-muted" aria-label={t("regulars.metAria", { met: metCount, total })}>
          {t("regulars.metCount", { met: hydrated ? metCount : "–", total })}
        </span>
      </header>

      {/* 필터 — 단일 선택. 줄 안에서만 가로 스크롤 */}
      <div
        role="group"
        aria-label={t("regulars.filterGroup")}
        className="mt-3.5 flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTER_KEYS.map((key) => (
          <Chip key={key} selected={filter === key} onClick={() => setFilter(key)} className="shrink-0">
            {filterLabel(key, t, lang)}
          </Chip>
        ))}
      </div>

      {!hydrated ? (
        <RegularsSkeleton />
      ) : (
        <div className="flex flex-col gap-6 px-screen pb-6 pt-4">
          {metEntries.length > 0 ? (
            <section className="flex flex-col gap-2.5">
              {metEntries.map((e) => (
                <MetRegularCard
                  key={e.regular.id}
                  regular={e.regular}
                  state={e.state}
                  month={month}
                  open={openId === e.regular.id}
                  onToggle={() => setOpenId((cur) => (cur === e.regular.id ? null : e.regular.id))}
                />
              ))}
            </section>
          ) : null}

          {otherEntries.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="まだ会ってない" aside={t("regulars.notMetYet")} />
              <div className="grid grid-cols-3 gap-2.5">
                {otherEntries.map((e) =>
                  e.status === "locked" ? (
                    <LockedCard
                      key={e.regular.id}
                      title="???"
                      caption={seasonBadge(e.regular, lang) ?? undefined}
                      hint={unlockHint(e.regular, lang) ?? t("regulars.soon")}
                    />
                  ) : (
                    <SilhouetteCard key={e.regular.id} regular={e.regular} />
                  ),
                )}
              </div>
            </section>
          ) : null}

          {visible.length === 0 ? (
            <Card variant="sunken" padding="lg" className="text-center">
              <p lang="ja" className="font-jp text-bubble text-ink">
                まだ誰も
              </p>
              <p className="mt-1 font-ko text-caption text-ink-muted">{t("regulars.noMatch")}</p>
            </Card>
          ) : null}
        </div>
      )}
    </Screen>
  );
}

/* ───────────────────────── 만난 단골 카드 ───────────────────────── */

interface MetRegularCardProps {
  regular: Regular;
  state: RegularState;
  /** 이번 달(1~12). 복원 전엔 null */
  month: number | null;
  open: boolean;
  onToggle: () => void;
}

function MetRegularCard({ regular, state, month, open, onToggle }: MetRegularCardProps) {
  const { t, lang } = useT();
  const panelId = useId();
  const affinity = Math.max(0, Math.min(AFFINITY_MAX, state.affinity));
  const line = currentLine(regular, affinity);
  const lineOpen = line.affinity <= affinity;
  const { name: slotName } = slotMeta(regular, lang);
  const heardSet = new Set(state.firstWordsHeard);
  const heard = regular.firstWords.filter((w) => heardSet.has(w.ja));
  const sortedLines = regular.lines.slice().sort((a, b) => a.affinity - b.affinity);
  const season = seasonBadge(regular, lang);
  const role = capPair(regular.role, regular.roleEn, lang);
  const seasonAway = regular.unlock.type === "season" && month !== null && month !== regular.unlock.month;
  const isShinya = regular.slots.includes("shinya");

  return (
    <Card padding="none" radius="4xl" data-regular={regular.id} data-status="met">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full gap-3.5 rounded-4xl p-4 text-left focus-visible:shadow-focus"
      >
        {/* 아바타 타일 84px — 아바타를 바닥에 붙여 상반신만 보이게 */}
        <div
          aria-hidden="true"
          className="flex size-[84px] shrink-0 items-end justify-center overflow-hidden rounded-4xl bg-surface-sunken"
        >
          <Avatar name={regular.nameJa} visual={regular.visual} size="sm" body className="-mb-2 translate-y-1" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span lang="ja" className="truncate font-jp text-[18px] font-extrabold leading-tight text-ink">
                {regular.nameJa}
              </span>
              {/* 자막 이름이 본문(nameJa)과 같으면(Mike) 두 번 쓰지 않는다 */}
              {capPair(regular.nameKo, regular.nameEn, lang) !== regular.nameJa ? (
                <span className="shrink-0 font-ko text-caption text-ink-muted">{capPair(regular.nameKo, regular.nameEn, lang)}</span>
              ) : null}
            </span>
            <Badge tone="perfect" className="shrink-0">
              {t("regulars.slotRegular", { slot: slotName })}
            </Badge>
          </div>
          {isShinya || season ? (
            <div className="flex flex-wrap items-center gap-1">
              {isShinya ? (
                <Badge tone="shell">
                  <span lang="ja">深夜</span>
                </Badge>
              ) : null}
              {season ? (
                <Badge tone={seasonAway ? "muted" : "combo"} data-testid="season-badge">
                  {season}
                  {seasonAway ? ` · ${t("regulars.lockedSuffix")}` : ""}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <span className="font-ko text-caption text-ink-muted">
            {role} · {t("regulars.metTimes", { n: state.metCount })} ·{" "}
            <span lang="ja" className="font-jp">
              「{regular.tic}」
            </span>
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-label text-ink-muted">{t("regulars.affinity")}</span>
            <AffinityDots value={affinity} />
          </div>

          <div className="mt-0.5 flex flex-col gap-0.5 rounded-lg bg-surface px-2.5 py-2">
            <span lang="ja" className="font-jp text-caption font-bold text-ink">
              {lineOpen ? `「${line.ja}」` : "「・・・」"}
            </span>
            <span className="font-ko text-label font-medium tracking-normal text-ink-muted">
              {lineOpen
                ? `${cap(line, lang)} · ${t("regulars.opensAt", { n: line.affinity })}`
                : t("regulars.opensAt", { n: line.affinity })}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-label text-ink-muted">
              {t("regulars.firstWords")} ·{" "}
              {heard.length > 0 ? (
                <span lang="ja" className="font-jp text-ink">
                  {heard
                    .slice(0, 2)
                    .map((w) => `「${w.ja}」`)
                    .join(" ")}
                  {heard.length > 2 ? ` +${heard.length - 2}` : ""}
                </span>
              ) : (
                <span lang="ja" className="font-jp">
                  ・・・
                </span>
              )}
            </span>
            <Icon
              name="chevronDown"
              size={18}
              strokeWidth={2.5}
              className={cn("text-ink-muted transition-transform motion-reduce:transition-none", open && "rotate-180")}
            />
          </div>
        </div>
      </button>

      <div id={panelId} hidden={!open} className="border-t border-border px-4 pb-4 pt-3">
        {open ? (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-label text-ink-muted">{t("regulars.linesByAffinity")}</h3>
              <ul className="flex flex-col gap-2">
                {sortedLines.map((l) => {
                  const reached = l.affinity <= affinity;
                  return (
                    <li key={l.affinity} className="flex gap-2.5" data-reached={reached}>
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md font-num text-label",
                          reached ? "bg-accent-soft text-accent" : "bg-surface-sunken text-ink-muted",
                        )}
                        aria-label={t("regulars.affinityN", { n: l.affinity })}
                      >
                        {l.affinity}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span
                          lang="ja"
                          className={cn("font-jp text-body font-bold", reached ? "text-ink" : "text-ink-muted")}
                        >
                          {reached ? l.ja : "・・・"}
                        </span>
                        {reached ? <span className="font-ko text-caption text-ink-muted">{cap(l, lang)}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-label text-ink-muted">
                {t("regulars.firstWords")} · {heard.length} / {regular.firstWords.length}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {regular.firstWords.map((w) => (
                  <FirstWordCard key={w.ja} word={w} heard={heardSet.has(w.ja)} phrase={findPhraseFor(w, konbini.phrases)} />
                ))}
              </ul>
              {heard.length > 0 ? (
                <p className="m-0 text-micro font-bold text-ink-muted">{t("regulars.longPressHint")}</p>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** 호감도 5칸 바 (18×8). 채운 칸은 accent, 빈 칸은 border */
function AffinityDots({ value }: { value: number }) {
  const { t } = useT();
  return (
    <span role="img" aria-label={t("regulars.affinityOf", { value, max: AFFINITY_MAX })} className="inline-flex gap-[3px]">
      {Array.from({ length: AFFINITY_MAX }, (_, i) => (
        <span key={i} className={cn("h-2 w-[18px] rounded-xs", i < value ? "bg-accent" : "bg-border")} />
      ))}
    </span>
  );
}

/* ───────────────────────── 처음 들은 말 — 문장 카드 ───────────────────────── */

interface FirstWordCardProps {
  word: CustomerReply;
  heard: boolean;
  /** 같은 일본어의 접객 문구(있으면 읽기·단어 분해를 보여준다) */
  phrase?: Phrase;
}

/**
 * 문장 카드. 들은 말만 길게 누르기(500ms)로 한국어 번역 + 단어 분해를 펼친다.
 * 키보드는 Enter/Space 로 토글, aria-expanded 로 상태를 알린다.
 */
function FirstWordCard({ word, heard, phrase }: FirstWordCardProps) {
  const { t, lang } = useT();
  const detailId = useId();
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clear, []);

  const onPointerDown = () => {
    if (!heard) return;
    clear();
    timer.current = setTimeout(() => {
      timer.current = null;
      setExpanded((v) => !v);
    }, LONG_PRESS_MS);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!heard) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded((v) => !v);
    }
  };

  return (
    <li
      data-heard={heard}
      className={cn("rounded-lg", heard ? "bg-surface-raised shadow-hairline" : "bg-surface-sunken")}
    >
      <button
        type="button"
        disabled={!heard}
        aria-expanded={heard ? expanded : undefined}
        aria-controls={heard ? detailId : undefined}
        aria-label={heard ? t("regulars.wordAria", { ja: word.ja }) : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "flex min-h-touch w-full select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left",
          "focus-visible:shadow-focus disabled:cursor-default",
          "[-webkit-touch-callout:none]",
        )}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span lang="ja" className={cn("font-jp text-body font-bold", heard ? "text-ink" : "text-ink-muted")}>
            「{word.ja}」
          </span>
          {heard && (word.reading ?? phrase?.reading) && (word.reading ?? phrase?.reading) !== word.ja ? (
            <span lang="ja" className="font-jp text-label font-medium tracking-normal text-ink-muted">
              {word.reading ?? phrase?.reading}
            </span>
          ) : null}
        </span>
        {heard ? <Icon name="check" size={16} strokeWidth={2.5} label={t("regulars.heard")} className="text-perfect-ink" /> : null}
      </button>
      {heard ? (
        <div id={detailId} hidden={!expanded} className="flex flex-col gap-1 border-t border-border px-2.5 pb-2.5 pt-2">
          <span className="font-ko text-caption text-ink">{cap(word, lang)}</span>
          {(word.parts ?? phrase?.parts) ? (
            <span lang="ja" className="font-jp text-label font-medium tracking-normal text-ink-muted" data-testid="word-parts">
              {word.parts ?? phrase?.parts}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/* ───────────────────────── 실루엣 카드(열렸지만 아직 못 만남) ───────────────────────── */

function SilhouetteCard({ regular }: { regular: Regular }) {
  const { t, lang } = useT();
  const { kanji } = slotMeta(regular);
  const season = seasonBadge(regular, lang);
  return (
    <Card
      variant="sunken"
      padding="none"
      radius="2xl"
      data-regular={regular.id}
      data-status="unmet"
      className="flex flex-col items-center gap-1.5 px-1.5 py-3 text-center"
    >
      {/* 색을 전부 회색 토큰으로 바꿔 실루엣만 남긴다 */}
      <Avatar
        name={t("regulars.notMetYet")}
        size="md"
        visual={{
          hairStyle: regular.visual.hairStyle,
          skin: "var(--color-border)",
          hairColor: "var(--color-border-strong)",
        }}
        className="opacity-80"
      />
      <span lang="ja" className="font-jp text-[13px] font-extrabold text-ink-muted">
        ???
      </span>
      <span className="font-ko text-micro font-bold text-ink-muted">
        <span lang="ja" className="font-jp">
          {kanji}
        </span>{" "}
        {t("regulars.appearsIn")}
      </span>
      {season ? <Badge tone="combo">{season}</Badge> : null}
    </Card>
  );
}

/* ───────────────────────── 스켈레톤 ───────────────────────── */

function RegularsSkeleton() {
  const { t } = useT();
  return (
    <div aria-busy="true" aria-label={t("regulars.loading")} className="flex flex-col gap-2.5 px-screen pt-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3.5 rounded-4xl bg-surface-raised p-4 shadow-hairline">
          <span className="size-[84px] shrink-0 animate-pulse rounded-4xl bg-surface-sunken motion-reduce:animate-none" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-5 w-2/5 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
            <span className="h-3 w-4/5 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
            <span className="h-12 w-full animate-pulse rounded-lg bg-surface-sunken motion-reduce:animate-none" />
          </span>
        </div>
      ))}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[108px] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
