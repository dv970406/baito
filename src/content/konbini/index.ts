import type { WorkplaceContent } from "@/engine/types";
import { konbiniItems } from "./items";
import { konbiniManager } from "./manager";
import { konbiniPhrases } from "./phrases";
import { konbiniRegulars } from "./regulars";
import { konbiniConfusedReplies, konbiniHints, konbiniLeaveReplies, konbiniReplies } from "./replies";
import { konbiniRanks, konbiniShifts } from "./shifts";

/** 첫 직장 KONBINI(편의점) 콘텐츠 전체 */
export const konbini: WorkplaceContent = {
  id: "konbini",
  code: "KONBINI",
  nameJa: "コンビニ",
  nameKo: "편의점",
  storeNameJa: "マルマート",
  storeBranchJa: "神田南口店",
  registerLabel: "レジ 02",
  items: konbiniItems,
  phrases: konbiniPhrases,
  regulars: konbiniRegulars,
  manager: konbiniManager,
  ranks: konbiniRanks,
  shifts: konbiniShifts,
  replies: konbiniReplies,
  confusedReplies: konbiniConfusedReplies,
  hints: konbiniHints,
  leaveReplies: konbiniLeaveReplies,
};

export { konbiniItems, konbiniPhrases, konbiniRegulars, konbiniManager, konbiniRanks, konbiniShifts };
