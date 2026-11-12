"use client";

/**
 * 00 BAITO 이력서 · 직장 선택 (셸 톤).
 * 플레이어 프로필(이름·시급·시프트 수·연속 출근·직급)과 직장 목록을 보여주고 KONBINI 로 출근시킨다.
 * 세이브는 SaveSync 가 복원하므로 `hydrated` 전에는 같은 레이아웃의 스켈레톤을 그린다(SSR 불일치 방지).
 */
import { useId, useState, type KeyboardEvent } from "react";
import {
  Avatar,
  Badge,
  CaptionLangToggle,
  Card,
  CtaButton,
  Icon,
  LockedCard,
  MoneyText,
  ProgressBar,
  SafeBottom,
  Screen,
  type IconName,
} from "@/components/ui";
import { konbini, workplaces, type WorkplaceMeta } from "@/content";
import { konbiniRanks } from "@/content/konbini/shifts";
import type { WorkplaceId } from "@/engine/types";
import { cn } from "@/lib/cn";
import { useGameStore } from "@/store/gameStore";
import { selectRank } from "@/store/selectors";
import { cap, capPair } from "@/i18n/caption";
import { useT } from "@/i18n/useT";

/** 직장 카드 타일 아이콘 */
const WORKPLACE_ICON: Record<WorkplaceId, IconName> = {
  konbini: "store",
  hoteru: "hotel",
  shokudo: "restaurant",
  kuko: "plane",
};

const KONBINI_HREF = "/konbini";

/** 직장 메타의 영어 자막 (콘텐츠 메타에 영어 필드가 생기면 그쪽으로 옮긴다) */
const WORKPLACE_EN: Record<WorkplaceId, { name: string; summary: string; hint: string }> = {
  konbini: { name: "Convenience store", summary: "Orders · heating · bags · payment", hint: "" },
  hoteru: { name: "Hotel front desk", summary: "Check-in · room guide · complaints", hint: "Apply after reaching store manager at KONBINI" },
  shokudo: { name: "Diner", summary: "Orders · toppings · allergies · checkout", hint: "Apply after reaching store manager at KONBINI" },
  kuko: { name: "Airport", summary: "Check-in · baggage · gate guidance", hint: "Opens as a short gig 7 days before your trip" },
};

/** 스켈레톤 자리표시 막대 (셸 배경용) */
function Skel({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-pulse rounded-sm bg-shell-border motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/* ───────────────────────── 이름 편집 ───────────────────────── */

interface NameFieldProps {
  name: string;
  ready: boolean;
  onSave: (name: string) => void;
}

/** 탭하면 입력창으로 바뀌는 이름. Enter·blur 로 저장, Escape 로 취소 */
function NameField({ name, ready, onSave }: NameFieldProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputId = useId();

  if (!ready) {
    return <Skel className="h-6 w-20" />;
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== name) onSave(draft);
    else setDraft(name);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setDraft(name);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        id={inputId}
        aria-label={t("resume.nameLabel")}
        autoFocus
        value={draft}
        maxLength={20}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="min-h-touch w-40 rounded-md border-[1.5px] border-shell-border bg-shell-raised px-2 font-jp text-phrase-lg text-shell-ink focus-visible:border-brand"
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={t("resume.editName", { name })}
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      className="-mx-2 -my-2 inline-flex min-h-touch items-center gap-1.5 rounded-md px-2 text-left font-jp text-phrase-lg text-shell-ink"
    >
      {name}
      <span aria-hidden="true" className="text-label text-shell-muted">
        編集
      </span>
    </button>
  );
}

/* ───────────────────────── 직장 카드 ───────────────────────── */

interface KonbiniCardProps {
  meta: WorkplaceMeta;
  ready: boolean;
  rankKo: string;
  /** 점장까지 남은 직급 수 */
  stepsToTencho: number;
  /** 점장까지 전체 진행도 0~1 */
  progress: number;
}

/** 근무 중인 KONBINI 카드 — 홈으로 들어가는 링크 */
function KonbiniCard({
  meta,
  ready,
  rankKo,
  stepsToTencho,
  progress,
}: KonbiniCardProps) {
  const { t, lang } = useT();
  const name = capPair(meta.nameKo, WORKPLACE_EN[meta.id].name, lang);
  return (
    <Card
      as="link"
      href={KONBINI_HREF}
      variant="raised"
      radius="4xl"
      padding="lg"
      elevation="press-lg"
      aria-label={t("resume.toWorkplaceHome", { code: meta.code, name })}
    >
      <div className="flex gap-3.5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink">
          <Icon name={WORKPLACE_ICON[meta.id]} size={32} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-jp text-heading text-ink">
              {meta.code} · {name}
            </span>
            <Badge tone="perfect">{t("resume.working")}</Badge>
          </div>
          <span className="text-caption text-ink-muted">
            {konbini.storeNameJa} {konbini.storeBranchJa} ·{" "}
            {ready ? rankKo : "…"}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar
              value={ready ? progress : 0}
              tone="brand"
              label={t("resume.progressToTencho")}
              className="flex-1"
            />
            <span className="whitespace-nowrap text-label text-ink-muted">
              {ready
                ? stepsToTencho > 0
                  ? t("resume.stepsToTencho", { n: stepsToTencho })
                  : t("resume.tenchoReached")
                : "…"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ───────────────────────── 화면 ───────────────────────── */

export function ResumeScreen() {
  const hydrated = useGameStore((s) => s.hydrated);
  const profile = useGameStore((s) => s.profile);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const setName = useGameStore((s) => s.setName);
  const setAudioEnabled = useGameStore((s) => s.setAudioEnabled);
  const resetAll = useGameStore((s) => s.resetAll);

  const [confirmReset, setConfirmReset] = useState(false);
  const { t, lang } = useT();

  const ready = hydrated;
  const rank = selectRank(profile, konbiniRanks);
  const sortedRanks = konbiniRanks
    .slice()
    .sort((a, b) => a.shiftsRequired - b.shiftsRequired);
  const rankIdx = sortedRanks.findIndex((r) => r.id === rank.current.id);
  const stepsToTencho = sortedRanks.length - 1 - rankIdx;
  const tenchoShifts = sortedRanks[sortedRanks.length - 1].shiftsRequired;
  const overallProgress =
    tenchoShifts > 0 ? Math.min(1, profile.totalShifts / tenchoShifts) : 1;
  const openCount = workplaces.filter((w) => w.status === "open").length;

  return (
    <Screen tone="shell">
      {/* 브랜드 헤더 */}
      <header
        aria-busy={!ready || undefined}
        className="flex items-center justify-between px-shell pt-1"
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex size-9 items-center justify-center rounded-[10px] bg-brand font-jp text-[15px] font-extrabold tracking-wide text-brand-ink"
          >
            バ
          </span>
          <span className="font-jp text-[20px] font-extrabold tracking-[0.12em] text-shell-ink">
            BAITO
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-caption font-bold text-shell-muted">
            履歴書 · {t("resume.header")}
          </span>
          <CaptionLangToggle tone="shell" />
        </div>
      </header>

      {/* 프로필 */}
      <section
        aria-label={t("resume.header")}
        className="mt-5 flex items-center gap-3.5 px-shell"
      >
        <Avatar name={ready ? profile.name : t("resume.defaultName")} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <NameField name={profile.name} ready={ready} onSave={setName} />
          <span className="text-caption text-shell-muted">
            {t("resume.residence", { place: "東京・神田" })} ·{" "}
            {ready ? (
              t("resume.shiftsCount", { n: profile.totalShifts })
            ) : (
              <Skel className="h-3 w-14" />
            )}
          </span>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end">
          <span className="text-label text-shell-muted">{t("resume.currentWage")}</span>
          {ready ? (
            <MoneyText
              yen={profile.wage}
              size="money-lg"
              className="text-register-glow"
            />
          ) : (
            <Skel className="mt-1 h-5 w-16" />
          )}
        </div>
      </section>

      {/* 연속 출근 · 휴가 · 직급 */}
      <section aria-label={t("resume.workRecord")} className="mt-4 px-shell">
        <Card variant="shell" radius="3xl" padding="md">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-label text-shell-muted">{t("common.streak")}</span>
              {ready ? (
                <span className="font-num text-money-lg text-shell-ink">
                  {profile.streak}
                  <span className="ml-0.5 text-caption font-bold text-shell-muted">
                    {t("resume.unitDays")}
                  </span>
                </span>
              ) : (
                <Skel className="h-6 w-10" />
              )}
              <span className="text-micro text-shell-muted">
                {ready ? t("resume.leavesLeft", { n: profile.leavesLeft }) : t("resume.leavesPending")}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-label text-shell-muted">{t("resume.totalShifts")}</span>
              {ready ? (
                <span className="font-num text-money-lg text-shell-ink">
                  {profile.totalShifts}
                  <span className="ml-0.5 text-caption font-bold text-shell-muted">
                    {t("resume.unitShifts")}
                  </span>
                </span>
              ) : (
                <Skel className="h-6 w-10" />
              )}
              <span className="text-micro text-shell-muted">
                {ready && rank.next
                  ? t("resume.toPromotion", { n: rank.shiftsToNext })
                  : ready
                    ? t("common.topRank")
                    : t("resume.toPromotionPending")}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-label text-shell-muted">{t("resume.rank")}</span>
              {ready ? (
                <span
                  lang="ja"
                  className="font-jp text-pos-option text-shell-ink"
                >
                  {rank.current.ja}
                </span>
              ) : (
                <Skel className="h-5 w-12" />
              )}
              <span className="text-micro text-shell-muted">
                {ready ? cap(rank.current, lang) : "—"}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* 직장 목록 */}
      <section aria-labelledby="workplaces-heading" className="mt-6 px-shell">
        <div className="flex items-baseline justify-between">
          <h1
            id="workplaces-heading"
            className="font-jp text-heading text-shell-ink"
          >
            バイト先 · {t("resume.workplaces")}
          </h1>
          <span className="text-caption text-shell-muted">
            {t("resume.openCount", { open: openCount, total: workplaces.length })}
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {workplaces.map((meta) => (
            <li key={meta.id}>
              {meta.status === "open" ? (
                <KonbiniCard
                  meta={meta}
                  ready={ready}
                  rankKo={cap(rank.current, lang)}
                  stepsToTencho={stepsToTencho}
                  progress={overallProgress}
                />
              ) : (
                <LockedCard
                  variant="shell"
                  icon={WORKPLACE_ICON[meta.id]}
                  title={`${meta.code} · ${capPair(meta.nameKo, WORKPLACE_EN[meta.id].name, lang)}`}
                  caption={capPair(meta.summaryKo, WORKPLACE_EN[meta.id].summary, lang)}
                  hint={capPair(meta.unlockHintKo, WORKPLACE_EN[meta.id].hint, lang)}
                  trailing={
                    meta.status === "travel" ? (
                      <Badge tone="combo">{t("resume.travelPack")}</Badge>
                    ) : undefined
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 하단 CTA + 설정 */}
      <SafeBottom inset="shell" className="mt-8">
        <CtaButton as="link" href={KONBINI_HREF}>
          {t("resume.cta", { code: konbini.code })}
        </CtaButton>
        <p className="text-center text-label font-medium tracking-normal text-shell-muted">
          {t("resume.note")}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-pressed={audioEnabled}
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-md px-1 text-caption font-bold text-shell-muted"
          >
            <Icon name="play" size={14} />
            {audioEnabled ? t("resume.soundOn") : t("resume.soundOff")}
          </button>
          {confirmReset ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                }}
                className="inline-flex min-h-touch items-center rounded-md px-2 text-caption font-bold text-irritation-ink"
              >
                {t("resume.resetConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="inline-flex min-h-touch items-center rounded-md px-2 text-caption font-bold text-shell-muted"
              >
                {t("common.cancel")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex min-h-touch items-center rounded-md px-1 text-caption text-shell-muted"
            >
              {t("resume.reset")}
            </button>
          )}
        </div>
      </SafeBottom>
    </Screen>
  );
}
