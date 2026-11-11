import type { WorkplaceContent, WorkplaceId } from "@/engine/types";
import { konbini } from "./konbini";

export { konbini } from "./konbini";
export { workplaces } from "./workplaces";
export type { WorkplaceMeta } from "./workplaces";

/** 열려 있는 직장의 콘텐츠 */
const contents: Partial<Record<WorkplaceId, WorkplaceContent>> = {
  konbini,
};

/** 직장 ID 로 콘텐츠를 가져온다. 아직 데이터 폴더가 없는 직장은 명확한 에러를 던진다. */
export function getWorkplaceContent(id: WorkplaceId): WorkplaceContent {
  const content = contents[id];
  if (!content) {
    throw new Error(`아직 열리지 않은 직장: ${id}`);
  }
  return content;
}
