import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareSchedule, Dog } from "../../types/core.ts";
import SchedulesScreen from "../SchedulesScreen.tsx";
import {
  createScheduleGroup,
  updateScheduleGroup,
} from "../../lib/scheduleApi.ts";

vi.mock("../../lib/scheduleApi.ts", () => ({
  createScheduleGroup: vi.fn().mockResolvedValue([]),
  updateScheduleGroup: vi.fn().mockResolvedValue([]),
  updateSchedule: vi.fn().mockResolvedValue({}),
  deleteScheduleGroup: vi.fn().mockResolvedValue(undefined),
}));

const dogs: Dog[] = [
  { dogId: "dog-1", dogName: "Luna", householdId: "house-1", dogImage: "" },
  { dogId: "dog-2", dogName: "Bear", householdId: "house-1", dogImage: "" },
];

const groupedSchedule: CareSchedule = {
  id: "schedule-1",
  householdId: "house-1",
  groupId: "group-1",
  dogId: "dog-1",
  type: "walk",
  title: "Evening walk",
  timeOfDay: "18:00:00",
  recurrence: "daily",
  active: true,
  createdBy: "user-1",
};

const secondDogSchedule: CareSchedule = {
  ...groupedSchedule,
  id: "schedule-2",
  dogId: "dog-2",
};

const baseProps = {
  householdId: "house-1",
  dogs,
  members: [
    {
      householdId: "house-1",
      userId: "user-1",
      role: "owner" as const,
      status: "active" as const,
      displayName: "Alice",
    },
  ],
  currentUserId: "user-1",
  schedules: [groupedSchedule, secondDogSchedule],
  onChanged: vi.fn(),
  onBack: vi.fn(),
};

describe("SchedulesScreen multi-dog routines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows a grouped routine once with both dogs", () => {
    render(<SchedulesScreen {...baseProps} />);

    expect(screen.getByText(/Luna and Bear/)).toBeInTheDocument();
    expect(screen.getAllByText(/Evening walk/)).toHaveLength(1);
  });

  it("edits the whole group and can add a dog", async () => {
    const user = userEvent.setup();
    render(<SchedulesScreen {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(
      screen.getByRole("heading", { name: /edit routine/i }),
    ).toBeInTheDocument();

    const luna = screen.getByRole("button", { name: /Luna/ });
    const bear = screen.getByRole("button", { name: /Bear/ });
    expect(luna).toHaveAttribute("aria-pressed", "true");
    expect(bear).toHaveAttribute("aria-pressed", "true");

    const titleInput = screen.getByLabelText(/task name/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Night walk");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateScheduleGroup).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ title: "Night walk", type: "walk" }),
      ["dog-1", "dog-2"],
    );
    expect(baseProps.onChanged).toHaveBeenCalled();
  });

  it("creates a routine for as many dogs as selected", async () => {
    const user = userEvent.setup();
    render(<SchedulesScreen {...baseProps} schedules={[]} />);

    await user.click(screen.getByRole("button", { name: /Bear/ }));
    await user.type(screen.getByLabelText(/task name/i), "Morning walk");
    await user.click(screen.getByRole("button", { name: /add schedule/i }));

    expect(createScheduleGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        dogIds: ["dog-1", "dog-2"],
        title: "Morning walk",
      }),
    );
  });
});
