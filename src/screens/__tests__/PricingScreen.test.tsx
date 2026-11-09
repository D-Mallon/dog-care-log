import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PricingScreen from "../PricingScreen.tsx";

const baseProps = {
  currentPlan: null,
  isEntitled: false,
  isOwner: true,
  isLoading: false,
  error: null,
  onSelectPlan: vi.fn(),
  onManageBilling: vi.fn(),
  onRetry: vi.fn(),
  onBack: vi.fn(),
};

describe("PricingScreen", () => {
  it("shows all plans and starts checkout", async () => {
    const user = userEvent.setup();
    const onSelectPlan = vi.fn();

    render(<PricingScreen {...baseProps} onSelectPlan={onSelectPlan} />);

    expect(screen.getByText("€3.99")).toBeInTheDocument();
    expect(screen.getByText("€29")).toBeInTheDocument();
    expect(screen.getByText("€79")).toBeInTheDocument();

    const trialButtons = screen.getAllByRole("button", {
      name: /start 14-day free trial/i,
    });
    await user.click(trialButtons[0]);
    expect(onSelectPlan).toHaveBeenCalledWith("monthly");
  });

  it("does not let a member start checkout", () => {
    render(<PricingScreen {...baseProps} isOwner={false} />);

    expect(
      screen.getByText(/ask the household owner to start a plan/i),
    ).toBeInTheDocument();

    for (const button of screen.getAllByRole("button", {
      name: /start 14-day free trial/i,
    })) {
      expect(button).toBeDisabled();
    }
  });

  it("shows the current plan and sends owners to the billing portal", async () => {
    const user = userEvent.setup();
    const onManageBilling = vi.fn();

    render(
      <PricingScreen
        {...baseProps}
        currentPlan="yearly"
        isEntitled
        onManageBilling={onManageBilling}
      />,
    );

    expect(
      screen.getByText(/your household is on yearly plan/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /current plan/i }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: /manage billing and invoices/i }),
    );
    expect(onManageBilling).toHaveBeenCalledTimes(1);
  });
});
