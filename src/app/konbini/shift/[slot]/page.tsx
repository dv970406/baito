import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GameScreen } from "@/components/game/GameScreen";
import { GAME_SLOTS, isGameSlot } from "@/components/game/gameSlot";

/** 01 KONBINI 인게임 — /konbini/shift/asa|hiru|yoru|shinya, 승급 시험은 /konbini/shift/exam */
export function generateStaticParams() {
  return GAME_SLOTS.map((slot) => ({ slot }));
}

/**
 * params 를 읽는 부분은 Suspense 안으로 — App Shell 은 URL 과 무관해야 즉시 내비게이션이 된다
 * (Next 16 instant-shell-url-data 규칙).
 */
async function ShiftBySlot({ params }: { params: PageProps<"/konbini/shift/[slot]">["params"] }) {
  const { slot } = await params;
  if (!isGameSlot(slot)) notFound();
  return <GameScreen slot={slot} />;
}

/** params 해석 중 보여줄 셸 — GameScreen 의 복원 전 시트와 같은 톤 */
function ShiftFallback() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-end bg-surface px-4 pb-10 text-ink"
    >
      <p className="text-caption text-ink-muted">出勤準備中…</p>
    </main>
  );
}

export default function Page({ params }: PageProps<"/konbini/shift/[slot]">) {
  return (
    <Suspense fallback={<ShiftFallback />}>
      <ShiftBySlot params={params} />
    </Suspense>
  );
}
