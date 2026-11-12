// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, shareFile } from "../share";

const blob = new Blob(["png"], { type: "image/png" });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shareFile", () => {
  it("Web Share 가 파일을 지원하면 공유 시트로 → shared", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    Object.assign(navigator, { share, canShare });
    await expect(shareFile(blob, "a.png", "hello")).resolves.toBe("shared");
    expect(canShare).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0] as ShareData;
    expect(data.text).toBe("hello");
    expect(data.files?.[0]?.name).toBe("a.png");
    expect(data.files?.[0]?.type).toBe("image/png");
  });

  it("공유 시트를 닫으면 cancelled, 다운로드로 넘어가지 않는다", async () => {
    Object.assign(navigator, {
      share: vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")),
      canShare: vi.fn().mockReturnValue(true),
    });
    const createObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    await expect(shareFile(blob, "a.png", "hello")).resolves.toBe("cancelled");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("파일 공유를 지원하지 않으면 <a download> 로 저장 → downloaded", async () => {
    Object.assign(navigator, { share: vi.fn(), canShare: vi.fn().mockReturnValue(false) });
    const createObjectURL = vi.fn().mockReturnValue("blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("a.png");
      expect(this.href).toBe("blob:fake");
    });
    await expect(shareFile(blob, "a.png", "hello")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });

  it("downloadBlob 은 createObjectURL 이 없으면 false", () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: undefined }));
    expect(downloadBlob(blob, "a.png")).toBe(false);
  });
});
