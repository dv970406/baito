import { NotFoundMessage } from "@/components/screens/NotFoundMessage";

/** 없는 주소 — 점장이 돌려보낸다 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 bg-surface px-screen text-center">
      <p lang="ja" className="font-jp text-phrase-lg text-ink">ここじゃないよ。</p>
      <NotFoundMessage />
    </main>
  );
}
