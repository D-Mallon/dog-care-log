import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase.ts";
import HouseholdSetupScreen from "../HouseholdSetupScreen.tsx";

vi.mock("../../lib/supabase.ts", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const household = {
  id: "house-1",
  name: "The Murphys",
  inviteCode: "ABC123",
  createdBy: "user-1",
};

describe("HouseholdSetupScreen", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it("creates a household through the RPC", async () => {
    const user = userEvent.setup();
    const onHouseholdReady = vi.fn();
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: household,
      error: null,
    } as never);

    render(
      <HouseholdSetupScreen
        userIdInDB="user-1"
        onHouseholdReady={onHouseholdReady}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /create a new household/i }),
    );
    await user.type(
      screen.getByLabelText(/household name/i),
      "The Murphys",
    );
    await user.click(
      screen.getByRole("button", { name: /create household/i }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith("create_household", {
      p_name: "The Murphys",
    });
    expect(onHouseholdReady).toHaveBeenCalledWith(household);
  });

  it("joins a household through the RPC", async () => {
    const user = userEvent.setup();
    const onHouseholdReady = vi.fn();
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: household,
      error: null,
    } as never);

    render(
      <HouseholdSetupScreen
        userIdInDB="user-2"
        onHouseholdReady={onHouseholdReady}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /join an existing household/i }),
    );
    await user.type(screen.getByLabelText(/invite code/i), "abc123");
    await user.click(screen.getByRole("button", { name: /join household/i }));

    expect(supabase.rpc).toHaveBeenCalledWith("join_household", {
      p_code: "ABC123",
    });
    expect(onHouseholdReady).toHaveBeenCalledWith(household);
  });

  it("shows the RPC error when joining fails", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "Invite code not found" },
    } as never);

    render(
      <HouseholdSetupScreen
        userIdInDB="user-2"
        onHouseholdReady={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /join an existing household/i }),
    );
    await user.type(screen.getByLabelText(/invite code/i), "ZZZZZZ");
    await user.click(screen.getByRole("button", { name: /join household/i }));

    expect(
      await screen.findByText(/invite code not found/i),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
