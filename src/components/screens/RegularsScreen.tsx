"use client";

/**
 * 04 단골 도감(常連図鑑).
 * 만난 단골은 상세 카드(아코디언)로, 아직 못 만난 손님은 3열 그리드(실루엣·잠김)로 보여준다.
 * 보이는 숫자는 만남 횟수·호감도뿐 — 학습 지표는 어디에도 없다.
 */
import { useId, useMemo, useState } from "react";
import type { Regular, ShiftSlot } from "@/engine/types";
import { AFFINITY_MAX, isRegularUnlocked, rankFor } from "@/engine/progression";
import { konbini } from "@/content";
import type { RegularState } from "@/shared/player";
import { useGameStore } from "@/store/gameStore";
import { selectAvailableSlots, selectRegularsMetCount } from "@/store/selectors";
import { Avatar, Badge, Card, Chip, Icon, LockedCard, Screen, SectionHeader, TabBar } from "@/components/ui";
import { cn } from "@/lib/cn";

/* ───────────────────────── 필터 ───────────────────────── */

type FilterKey = "all" | "met" | "unmet" | ShiftSlot;

interface FilterDef {
  key: FilterKey;
  label: string;
}

const FILTERS: readonly FilterDef[] = [
  { key: "all", label: "전체" },
  { key: "met", label: "만난 단골" },
  { key: "unmet", label: "미발견" },
  { key: "asa", label: `${konbini.shifts.asa.kanji} ${konbini.shifts.asa.nameKo}` },
  { key: "hiru", label: `${konbini.shifts.hiru.kanji} ${konbini.shifts.hiru.nameKo}` },
  { key: "yoru", label: `${konbini.shifts.yoru.kanji} ${konbini.shifts.yoru.nameKo}` },
];

/** 도감에서 레귤러 한 명이 놓이는 상태 */
type EntryStatus = "met" | "unmet" | "locked";

interface Entry {
  regular: Regular;
  state: RegularState;
  status: EntryStatus;
}

const EMPTY_STATE: RegularState = { affinity: 0, metCount: 0, lastMetDate: null, firstWordsHeard: [] };

/** 레귤러의 대표 시간대(첫 슬롯) 한자·한국어 */
function slotMeta(regular: Regular) {
  const slot = regular.slots[0] ?? "asa";
  const cfg = konbini.shifts[slot];
  return { kanji: cfg.kanji, nameKo: cfg.nameKo };
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

  const regulars = konbini.regulars;
  const total = regulars.length;
  const metCount = selectRegularsMetCount(profile);

  const entries = useMemo<Entry[]>(() => {
    if (!hydrated) return [];
    const rank = rankFor(profile.totalShifts, konbini.ranks).current.id;
    const month = new Date().getMonth() + 1;
    const slots = selectAvailableSlots(profile);
    return regulars.map((regular) => {
      const state = profile.regulars[regular.id] ?? EMPTY_STATE;
      if (state.metCount > 0) return { regular, state, status: "met" as const };
      // 시간대 조건은 "오늘 들어갈 수 있는 시프트" 중 하나라도 맞으면 열린 것으로 본다
      const unlocked = slots.some((slot) =>
        isRegularUnlocked(regular, { rank, slot, month, ranks: konbini.ranks }),
      );
      return { regular, state, status: unlocked ? ("unmet" as const) : ("locked" as const) };
    });
  }, [hydrated, profile, regulars]);

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
          <span className="font-ko text-caption text-ink-muted">단골 도감</span>
        </div>
        <span className="text-[13px] font-bold text-ink-muted" aria-label={`만난 단골 ${metCount} / ${total}`}>
          {hydrated ? metCount : "–"} / {total} 만남
        </span>
      </header>

      {/* 필터 — 단일 선택. 줄 안에서만 가로 스크롤 */}
      <div
        role="group"
        aria-label="도감 필터"
        className="mt-3.5 flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)} className="shrink-0">
            {f.label}
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
                  open={openId === e.regular.id}
                  onToggle={() => setOpenId((cur) => (cur === e.regular.id ? null : e.regular.id))}
                />
              ))}
            </section>
          ) : null}

          {otherEntries.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="まだ会ってない" aside="아직 못 만난 손님" />
              <div className="grid grid-cols-3 gap-2.5">
                {otherEntries.map((e) =>
                  e.status === "locked" ? (
                    <LockedCard
                      key={e.regular.id}
                      title="???"
                      hint={e.regular.unlock.type === "open" ? "곧 만날 수 있어요" : e.regular.unlock.label}
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
              <p className="mt-1 font-ko text-caption text-ink-muted">이 조건에 맞는 손님이 없어요</p>
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
  open: boolean;
  onToggle: () => void;
}

function MetRegularCard({ regular, state, open, onToggle }: MetRegularCardProps) {
  const panelId = useId();
  const affinity = Math.max(0, Math.min(AFFINITY_MAX, state.affinity));
  const line = currentLine(regular, affinity);
  const lineOpen = line.affinity <= affinity;
  const { nameKo: slotKo } = slotMeta(regular);
  const heardSet = new Set(state.firstWordsHeard);
  const heard = regular.firstWords.filter((w) => heardSet.has(w.ja));
  const sortedLines = regular.lines.slice().sort((a, b) => a.affinity - b.affinity);

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
              <span className="shrink-0 font-ko text-caption text-ink-muted">{regular.nameKo}</span>
            </span>
            <Badge tone="perfect">{slotKo} 단골</Badge>
          </div>

          <span className="font-ko text-caption text-ink-muted">
            {regular.role} · {state.metCount}번 만남 ·{" "}
            <span lang="ja" className="font-jp">
              「{regular.tic}」
            </span>
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-label text-ink-muted">호감도</span>
            <AffinityDots value={affinity} />
          </div>

          <div className="mt-0.5 flex flex-col gap-0.5 rounded-lg bg-surface px-2.5 py-2">
            <span lang="ja" className="font-jp text-caption font-bold text-ink">
              {lineOpen ? `「${line.ja}」` : "「・・・」"}
            </span>
            <span className="font-ko text-label font-medium tracking-normal text-ink-muted">
              {lineOpen ? `${line.ko} · 호감도 ${line.affinity}에서 열림` : `호감도 ${line.affinity}에서 열림`}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-label text-ink-muted">
              처음 들은 말 ·{" "}
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
              <h3 className="text-label text-ink-muted">호감도별 한마디</h3>
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
                        aria-label={`호감도 ${l.affinity}`}
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
                        {reached ? <span className="font-ko text-caption text-ink-muted">{l.ko}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-label text-ink-muted">
                처음 들은 말 · {heard.length} / {regular.firstWords.length}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {regular.firstWords.map((w) => {
                  const isHeard = heardSet.has(w.ja);
                  return (
                    <li
                      key={w.ja}
                      data-heard={isHeard}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2",
                        isHeard ? "bg-surface-raised shadow-hairline" : "bg-surface-sunken",
                      )}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span
                          lang="ja"
                          className={cn("font-jp text-body font-bold", isHeard ? "text-ink" : "text-ink-muted")}
                        >
                          「{w.ja}」
                        </span>
                        {isHeard ? <span className="font-ko text-caption text-ink-muted">{w.ko}</span> : null}
                      </span>
                      {isHeard ? (
                        <Icon name="check" size={16} strokeWidth={2.5} label="들었음" className="text-perfect-ink" />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** 호감도 5칸 바 (18×8). 채운 칸은 accent, 빈 칸은 border */
function AffinityDots({ value }: { value: number }) {
  return (
    <span role="img" aria-label={`호감도 ${value} / ${AFFINITY_MAX}`} className="inline-flex gap-[3px]">
      {Array.from({ length: AFFINITY_MAX }, (_, i) => (
        <span key={i} className={cn("h-2 w-[18px] rounded-xs", i < value ? "bg-accent" : "bg-border")} />
      ))}
    </span>
  );
}

/* ───────────────────────── 실루엣 카드(열렸지만 아직 못 만남) ───────────────────────── */

function SilhouetteCard({ regular }: { regular: Regular }) {
  const { kanji } = slotMeta(regular);
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
        name="아직 못 만난 손님"
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
        시프트에 나타남
      </span>
    </Card>
  );
}

/* ───────────────────────── 스켈레톤 ───────────────────────── */

function RegularsSkeleton() {
  return (
    <div aria-busy="true" aria-label="도감 불러오는 중" className="flex flex-col gap-2.5 px-screen pt-4">
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
