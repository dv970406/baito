"use client";

/** 404 화면의 자막·버튼 — 자막 언어를 따르도록 클라이언트에서 그린다(복원 전엔 ko) */
import Link from "next/link";
import { useT } from "@/i18n/useT";

export function NotFoundMessage() {
  const { t } = useT();
  return (
    <>
      <p className="font-ko text-caption text-ink-muted">{t("notFound.body")}</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-cta items-center justify-center rounded-pill bg-brand px-6 text-money text-brand-ink shadow-press"
      >
        {t("notFound.cta")}
      </Link>
    </>
  );
}
