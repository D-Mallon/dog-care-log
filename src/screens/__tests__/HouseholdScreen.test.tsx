import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HouseholdScreen from "../HouseholdScreen.tsx";

const members = [
  {
    userId: "user-1",
    displayName: "Alice",
    role: "owner" as const,
    status: "active" as const,
    joinedAt: "2026-11-01T10:00:00Z",
  },
  {
    userId: "user-2",
    displayName: "Bob",
    role: "member" as const,
    status: "active" as const,
    joinedAt: "2026-11-02T10:00:00Z",
  },
];

const baseProps = {
  householdName: "The Murphys",
  inviteCode: "ABC123",
  currentUserId: "user-1",
  isOwner: true,
  members,
  isLoading: false,
  error: null,
  onBack: vi.fn(),
  onCopyCode: vi.fn().mockResolvedValue(true),
  onRename: vi.fn().mockResolvedValue(undefined),
  onRegenerateCode: vi.fn().mockResolvedValue(undefined),
  onRemoveMember: vi.fn().mockResolvedValue(undefined),
  onLeave: vi.fn().mockResolvedValue(undefined),
};

describe("HouseholdScreen", () => {
  it("reveals and copies the invite code", async () => {
    const user = userEvent.setup();
    const onCopyCode = vi.fn().mockResolvedValue(true);

    render(<HouseholdScreen {...baseProps} onCopyCode={onCopyCode} />);

    expect(screen.getByText("••••••")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^show$/i }));
    expect(screen.getByText("ABC123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(onCopyCode).toHaveBeenCalledTimes(1);
  });

  it("shows owner controls and the member list", () => {
    render(<HouseholdScreen {...baseProps} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^rename$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate a new code/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^remove$/i })).toBeInTheDocument();
  });

  it("hides owner controls from members and confirms leaving", async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn().mockResolvedValue(undefined);

    render(
      <HouseholdScreen
        {...baseProps}
        currentUserId="user-2"
        isOwner={false}
        onLeave={onLeave}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^rename$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /generate a new code/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^remove$/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /leave household/i }),
    );
    await user.click(screen.getByRole("button", { name: /^leave$/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
