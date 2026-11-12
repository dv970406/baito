"use client";

/**
 * 서비스 워커 등록. 프로덕션에서만 /sw.js 를 등록하고, 개발 모드에서는 남아 있는 등록을 해제한다
 * (dev 에서 셸이 캐시되면 HMR 과 충돌한다). 렌더 결과는 없다.
 */
import { useEffect } from "react";

export function RegisterSw() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    if (process.env.NODE_ENV !== "production") {
      void sw.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => undefined);
      return;
    }
    void sw.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
