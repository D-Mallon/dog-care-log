import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LegalScreen from "../LegalScreen.tsx";

describe("LegalScreen", () => {
  it("shows a privacy policy without company placeholders", () => {
    render(<LegalScreen onBack={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Privacy & terms" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Privacy" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/what we collect/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/\[COMPANY NAME\]/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/\[CONTACT EMAIL\]/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/plain-language templates/i),
    ).not.toBeInTheDocument();
  });

  it("switches to terms and exposes refunds there", async () => {
    const user = userEvent.setup();
    render(<LegalScreen onBack={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Terms" }));

    expect(
      screen.getByRole("tab", { name: "Terms" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText(/cancellation, refunds and eu\/eea rights/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Refunds" })).not.toBeInTheDocument();
  });

  it("opens on the requested tab and goes back", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(<LegalScreen initialTab="terms" onBack={onBack} />);
    expect(
      screen.getByRole("tab", { name: "Terms" }),
    ).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
