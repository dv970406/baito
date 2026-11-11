"use client";

/**
 * 03 마감 영수증 — 가장 최근 시프트 요약을 영수증 종이로 보여준다.
 * 스토어(sessions[0])가 진실이고, 마감 직후 스토어 재렌더 전엔 sessionStorage 사본을 쓴다.
 * 지난 영수증을 펼쳐 고르면 그 영수증으로 바꿔 보여준다(로컬 상태).
 */
import Link from "next/link";
import { useRef, useState } from "react";
import type { ShiftSummary } from "@/engine/types";
import { konbini } from "@/content";
import {
  Barcode,
  Card,
  CtaButton,
  DashedDivider,
  Icon,
  KanjiBadge,
  ManagerNote,
  MoneyText,
  ReceiptPaper,
  Screen,
  StatRow,
  TabBar,
} from "@/components/ui";
import { TAG_KANJI, loadLastReceipt } from "@/components/game/shiftModel";
import { cn } from "@/lib/cn";
import { formatReceiptDate } from "@/lib/format";
import { shareText } from "@/lib/share";
import { useGameStore } from "@/store/gameStore";
import { buildShareText, pickManagerLine, shareToast, shortDate } from "./receiptModel";

/** 금액 템플릿(合計で {total}円です)은 영수증에서 손님별 금액이 없으므로 〇〇 로 중립 표기 */
function neutralTemplate(text: string): string {
  return text.replace("{total}", "〇〇");
}

const TOAST_MS = 2400;

export function ReceiptScreen() {
  const hydrated = useGameStore((s) => s.hydrated);
  const sessions = useGameStore((s) => s.sessions);
  const profile = useGameStore((s) => s.profile);
  // 마감 직후 폴백 — 복원 전엔 어차피 스켈레톤이라 초기화 때 한 번 읽어도 SSR 불일치가 없다
  const [fallback] = useState<ShiftSummary | null>(() => (typeof window === "undefined" ? null : loadLastReceipt()));
  const [selected, setSelected] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const list: ShiftSummary[] = sessions.length > 0 ? sessions : fallback ? [fallback] : [];
  const current = list[Math.min(selected, Math.max(0, list.length - 1))] ?? null;

  const handleShare = async () => {
    if (!current) return;
    const result = await shareText({
      title: "BAITO 마감 영수증",
      text: buildShareText(konbini, current),
      url: typeof window === "undefined" ? undefined : window.location.origin,
    });
    const message = shareToast(result);
    if (!message) return;
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  return (
    <Screen tone="accent" workplace="konbini" footer={<TabBar active="receipt" />}>
      <header className="flex items-center justify-between px-screen">
        <Link
          href="/konbini"
          aria-label="홈으로"
          className="inline-flex size-touch items-center justify-center rounded-pill bg-white/16 text-brand-ink focus-visible:shadow-focus"
        >
          <Icon name="close" size={20} strokeWidth={2.5} />
        </Link>
        <span lang="ja" className="font-jp text-[15px] font-extrabold tracking-[0.04em]">
          お疲れさまでした
        </span>
        <span aria-hidden="true" className="w-11" />
      </header>

      {!hydrated ? (
        <ReceiptPaper className="mx-7 mt-[18px] min-h-[320px] items-center justify-center" aria-busy="true">
          <span className="font-ko text-caption text-ink-muted" role="status">
            영수증을 꺼내는 중…
          </span>
        </ReceiptPaper>
      ) : current ? (
        <>
          <Receipt summary={current} playerName={profile.name} day={Math.max(1, profile.totalShifts - selected)} />
          {list.length > 1 ? (
            <History
              list={list}
              selected={selected}
              open={historyOpen}
              onToggle={() => setHistoryOpen((v) => !v)}
              onSelect={setSelected}
            />
          ) : null}
        </>
      ) : (
        <EmptyReceipt />
      )}

      <div className="mt-auto flex flex-col gap-2.5 px-screen pb-4 pt-5">
        {hydrated && current ? (
          <>
            <CtaButton variant="onSurface" icon="share" onClick={handleShare}>
              영수증 공유
            </CtaButton>
            <CtaButton as="link" href="/konbini" variant="ghost">
              다음 시프트
            </CtaButton>
          </>
        ) : null}
        <p role="status" aria-live="polite" className="m-0 min-h-4 text-center font-ko text-caption text-brand-ink">
          {toast ?? ""}
        </p>
      </div>
    </Screen>
  );
}

/* ───────────────────────── 영수증 종이 ───────────────────────── */

function Receipt({ summary, playerName, day }: { summary: ShiftSummary; playerName: string; day: number }) {
  const config = konbini.shifts[summary.slot];
  const hardestPhrase = summary.hardest ? konbini.phrases.find((p) => p.id === summary.hardest?.phraseId) : undefined;
  const regularsMet = summary.regularsMet
    .map((id) => konbini.regulars.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);
  const manager = pickManagerLine(konbini, summary);
  const wageBefore = summary.wageAfter - summary.wageDelta;

  return (
    <ReceiptPaper className="mx-7 mt-[18px]" aria-label="마감 영수증">
      <div className="flex flex-col items-center gap-1 pb-3.5">
        <span lang="ja" className="font-jp text-phrase-lg tracking-[0.1em] text-ink">
          {konbini.storeNameJa}
        </span>
        <span lang="ja" className="font-jp text-caption text-ink-muted">
          {konbini.storeBranchJa} · {konbini.registerLabel}
        </span>
        <span lang="ja" className="font-num text-caption text-ink-muted">
          {formatReceiptDate(summary.playedAt, config.kanji, config.hours)}
        </span>
        <span className="font-jp text-caption text-ink-muted">
          担当 <span className="font-ko">{playerName}</span>
        </span>
      </div>
      <DashedDivider />

      <div className="flex flex-col gap-2.5 py-3.5">
        <StatRow
          label={<Label ja="応対" ko="손님 응대" />}
          value={
            <>
              {summary.served}名<span className="text-ink-muted"> / {config.customerCount}</span>
            </>
          }
        />
        <StatRow label={<Label ja="離脱" ko="놓친 손님" />} value={`${summary.missed}名`} tone={summary.missed > 0 ? "irritation" : "default"} />
        <dl className="m-0 grid grid-cols-4 gap-1.5">
          <Grade label="Perfect" value={summary.perfects} tone="perfect" />
          <Grade label="Good" value={summary.goods} />
          <Grade label="OK" value={summary.oks} />
          <Grade label="Late" value={summary.lates} tone={summary.lates > 0 ? "combo" : undefined} />
        </dl>
        <StatRow label={<Label ja="最大コンボ" ko="최고 콤보" />} value={`×${summary.maxCombo}`} />
      </div>
      <DashedDivider />

      <div className="flex items-baseline justify-between pb-2.5 pt-3.5">
        <Label ja="今日の時給" ko="오늘 시급" strong />
        <MoneyText yen={summary.wageAfter} size="money-xl" />
      </div>
      <div className="flex items-baseline justify-between pb-3.5 font-ko text-caption text-ink-muted">
        <span>
          <MoneyText yen={wageBefore} className="text-caption font-medium" /> → <MoneyText yen={summary.wageAfter} className="text-caption font-medium" />
        </span>
        <MoneyText yen={summary.wageDelta} delta className="text-caption" />
      </div>
      <DashedDivider />

      {/* 가장 헷갈린 한마디 */}
      <div className="mt-3.5 flex flex-col gap-1 rounded-lg bg-combo-soft p-3">
        <span className="font-jp text-label text-combo">一番迷った一言 · 오늘 가장 헷갈린 한마디</span>
        {hardestPhrase && summary.hardest ? (
          <>
            <span lang="ja" className="font-jp text-[16px] font-extrabold leading-snug text-ink">
              {neutralTemplate(hardestPhrase.ja)}
            </span>
            <span className="font-ko text-caption text-ink-muted">
              {neutralTemplate(hardestPhrase.ko)}
              {" · "}
              {[
                summary.hardest.wrongCount > 0 ? `${summary.hardest.wrongCount}번 다른 말` : null,
                summary.hardest.lateCount > 0 ? `${summary.hardest.lateCount}번 늦게` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        ) : (
          <>
            <span lang="ja" className="font-jp text-[16px] font-extrabold leading-snug text-ink">
              なし
            </span>
            <span className="font-ko text-caption text-ink-muted">헷갈린 말이 없었어요</span>
          </>
        )}
      </div>

      {summary.firstSuccessTags.length > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label ja="初めて成功" ko="처음 성공" />
            <ul className="m-0 flex list-none gap-1 p-0" aria-label="처음 성공한 상품 종류">
              {summary.firstSuccessTags.map((tag) => (
                <li key={tag}>
                  <KanjiBadge kanji={TAG_KANJI[tag].kanji} tone="perfect" label={TAG_KANJI[tag].ko} />
                </li>
              ))}
            </ul>
          </div>
          <span className="font-num text-body font-bold text-perfect-ink">+¥40 ×{summary.firstSuccessTags.length}</span>
        </div>
      ) : null}

      {regularsMet.length > 0 ? (
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <Label ja="会った常連" ko="만난 단골" />
          <span lang="ja" className="text-right font-jp text-body font-bold text-ink">
            {regularsMet.map((r) => r.nameJa).join(" · ")}
          </span>
        </div>
      ) : null}

      {manager ? <ManagerNote ja={manager.ja} ko={manager.ko} variant="plain" className="mt-3.5" /> : null}

      <Barcode className="mt-4" />
      <span className="mt-1.5 text-center font-num text-micro tracking-[0.1em] text-ink-muted">
        BAITO · {konbini.code} · DAY {day}
      </span>
    </ReceiptPaper>
  );
}

function Label({ ja, ko, strong = false }: { ja: string; ko: string; strong?: boolean }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", strong && "font-bold")}>
      <span lang="ja" className="font-jp">
        {ja}
      </span>
      <span className="font-ko text-caption text-ink-muted">{ko}</span>
    </span>
  );
}

function Grade({ label, value, tone }: { label: string; value: number; tone?: "perfect" | "combo" }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-surface-sunken px-1 py-1.5">
      <dt className="font-num text-label text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "m-0 font-num text-money tabular-nums",
          tone === "perfect" && value > 0 ? "text-perfect-ink" : tone === "combo" ? "text-combo" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ───────────────────────── 지난 영수증 ───────────────────────── */

function History({
  list,
  selected,
  open,
  onToggle,
  onSelect,
}: {
  list: ShiftSummary[];
  selected: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="mx-7 mt-3" aria-label="지난 영수증">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-touch w-full items-center justify-between rounded-pill bg-white/16 px-4 font-ko text-[13px] font-bold text-brand-ink focus-visible:shadow-focus"
      >
        <span>지난 영수증 {list.length - 1}장</span>
        <Icon name="chevronDown" size={16} className={cn("transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open ? (
        <Card variant="raised" padding="none" radius="2xl" className="mt-2 overflow-hidden">
          <ul className="m-0 list-none p-0">
            {list.map((item, index) => {
              const config = konbini.shifts[item.slot];
              const isSelected = index === selected;
              return (
                <li key={`${item.playedAt}|${item.slot}`} className={cn(index > 0 && "border-t border-border")}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(index)}
                    className={cn(
                      "flex min-h-touch w-full items-center gap-3 px-3.5 py-2 text-left focus-visible:shadow-focus",
                      isSelected && "bg-accent-soft",
                    )}
                  >
                    <KanjiBadge kanji={config.kanji} tone={isSelected ? "accent" : "sunken"} label={`${config.nameKo} 시프트`} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-num text-body font-bold text-ink">{shortDate(item.playedAt)}</span>
                      <span className="font-ko text-caption text-ink-muted">
                        {index === 0 ? "최근 · " : ""}
                        {item.served}名 응대 · Perfect {item.perfects}
                      </span>
                    </span>
                    <MoneyText yen={item.wageDelta} delta />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

/* ───────────────────────── 빈 상태 ───────────────────────── */

function EmptyReceipt() {
  return (
    <div className="mx-7 mt-[18px]">
      <Card variant="raised" padding="lg" radius="3xl" className="flex flex-col gap-3">
        <span lang="ja" className="font-jp text-heading text-ink">
          まだレシートがありません
        </span>
        <p className="m-0 font-ko text-body text-ink">아직 영수증이 없어요.</p>
        <p className="m-0 font-ko text-caption text-ink-muted">첫 시프트를 마치면 마감 영수증이 여기 쌓여요.</p>
        <CtaButton as="link" href="/konbini" variant="primary" icon="calendar">
          出勤する
        </CtaButton>
      </Card>
    </div>
  );
}
