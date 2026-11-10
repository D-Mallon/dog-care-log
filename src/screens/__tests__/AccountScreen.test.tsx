import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AccountScreen from "../AccountScreen.tsx";

const baseProps = {
  email: "owner@example.com",
  householdName: "The Murphys",
  planLabel: "Yearly",
  isOwner: true,
  isEntitled: true,
  isDeleting: false,
  onExport: vi.fn(),
  onDelete: vi.fn().mockResolvedValue(true),
  onBack: vi.fn(),
};

describe("AccountScreen", () => {
  it("shows account, plan and export controls", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(<AccountScreen {...baseProps} onExport={onExport} />);

    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText(/The Murphys/)).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /download household report/i }),
    );
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("requires the user to type DELETE before confirming", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(true);

    render(<AccountScreen {...baseProps} onDelete={onDelete} />);

    await user.click(
      screen.getByRole("button", { name: /delete my account/i }),
    );

    const confirmButton = screen.getByRole("button", {
      name: /delete forever/i,
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(/type delete to confirm/i),
      "DELETE",
    );
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open and shows an error when deletion fails", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(false);

    render(<AccountScreen {...baseProps} onDelete={onDelete} />);

    await user.click(
      screen.getByRole("button", { name: /delete my account/i }),
    );
    await user.type(
      screen.getByLabelText(/type delete to confirm/i),
      "DELETE",
    );
    await user.click(
      screen.getByRole("button", { name: /delete forever/i }),
    );

    expect(
      await screen.findByText(/account deletion did not complete/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("explains that an owner with members cannot delete the household", async () => {
    const user = userEvent.setup();
    render(<AccountScreen {...baseProps} />);

    expect(
      screen.getByText(/remove other members first/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /delete my account/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
