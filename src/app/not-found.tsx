import Link from "next/link";

/** 없는 주소 — 점장이 돌려보낸다 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 bg-surface px-screen text-center">
      <p className="font-jp text-phrase-lg text-ink">ここじゃないよ。</p>
      <p className="font-ko text-caption text-ink-muted">여기가 아니에요. 이력서로 돌아갑니다.</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-cta items-center justify-center rounded-pill bg-brand px-6 text-money text-brand-ink shadow-press"
      >
        BAITO 이력서
      </Link>
    </main>
  );
}
