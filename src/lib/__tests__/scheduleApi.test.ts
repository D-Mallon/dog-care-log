import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduleGroup } from "../scheduleApi.ts";
import { toLocalDateKey } from "../schedules.ts";

const chain = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../supabase.ts", () => ({
  supabase: {
    from: vi.fn(() => ({ insert: chain.insert })),
  },
}));

const input = {
  householdId: "house-1",
  dogIds: ["dog-1", "dog-2"],
  type: "walk" as const,
  title: "Walk all dogs",
  timeOfDay: "18:00",
  recurrence: "daily" as const,
  assignedTo: null,
  createdBy: "user-1",
};

describe("createScheduleGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.insert.mockReturnValue({ select: chain.select });
    chain.select.mockResolvedValue({ data: [], error: null });
  });

  it("sends one row per dog with a non-null startDate", async () => {
    await createScheduleGroup(input);

    expect(chain.insert).toHaveBeenCalledTimes(1);
    const rows = chain.insert.mock.calls[0][0] as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.dogId)).toEqual(["dog-1", "dog-2"]);
    expect(new Set(rows.map((row) => row.groupId)).size).toBe(1);
    for (const row of rows) {
      expect(row.startDate).toBe(toLocalDateKey(new Date()));
      expect(row.startDate).not.toBeUndefined();
    }
  });

  it("honours an explicit startDate", async () => {
    await createScheduleGroup({ ...input, startDate: "2026-12-01" });

    const rows = chain.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows.every((row) => row.startDate === "2026-12-01")).toBe(true);
  });
});
