// @vitest-environment jsdom
/** 자막 언어 설정 — 영속 상태와 세이브 복원(localStorage 가 필요해 jsdom) */
import { describe, expect, it } from "vitest";

describe("자막 언어 설정", () => {
  it("기본은 ko, setCaptionLang 으로 바뀐다", async () => {
    const { useGameStore } = await import("../gameStore");
    expect(useGameStore.getState().captionLang).toBe("ko");
    useGameStore.getState().setCaptionLang("en");
    expect(useGameStore.getState().captionLang).toBe("en");
    useGameStore.getState().setCaptionLang("ko");
  });

  it("세이브 복원 시 잘못된 값은 기본값으로", async () => {
    const { useGameStore } = await import("../gameStore");
    const merge = useGameStore.persist.getOptions().merge!;
    const current = useGameStore.getState();
    expect(merge({ captionLang: "en" }, current).captionLang).toBe("en");
    expect(merge({ captionLang: "fr" }, current).captionLang).toBe("ko");
    expect(merge({}, current).captionLang).toBe("ko");
  });
});
