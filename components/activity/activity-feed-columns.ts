/** Shared padding + time column for Live cycles table and step timeline on /activity. */
export const activityFeedMinWidth = "min-w-[900px]";

/** Even column share for `table-fixed` (sums to 100%). */
export const activityTableColWidths = {
  time: "14%",
  agent: "27%",
  confidence: "15%",
  execution: "27%",
  status: "17%",
} as const;

/** Column order matches Live cycles table: Time · Agent · Execution · Confidence · Status */
export const activityFeedRowGrid = `grid ${activityFeedMinWidth} grid-cols-[14%_27%_27%_15%_17%] items-start justify-items-start text-left`;

export const activityFeedMetaCol = "col-start-2 min-w-0";
export const activityFeedDetailCol = "col-start-3 min-w-0";
/** Status column — action / verdict badges, aligned like status pills in the table. */
export const activityFeedActionCol = "col-start-5 min-w-0 justify-self-stretch text-right";

export const activityCellPad = "px-5 sm:px-6";
export const activityHeadPad = `${activityCellPad} pb-4 pt-5`;
export const activityBodyPad = `${activityCellPad} py-4`;
