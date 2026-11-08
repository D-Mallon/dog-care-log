import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LogEventScreen from "../LogEventScreen.tsx";

describe("LogEventScreen", () => {
  it("rejects an event dated in the future", async () => {
    const onSubmitEvent = vi.fn();

    render(
      <LogEventScreen
        selectedDogId="dog-1"
        onSubmitEvent={onSubmitEvent}
        userIdInDB="user-1"
      />,
    );

    fireEvent.click(screen.getByText("Fed").closest("label")!);
    const dateInput = screen.getByLabelText(/when did it happen/i);
    fireEvent.change(dateInput, {
      target: { value: "2999-01-01T00:00" },
    });
    expect(dateInput).toHaveValue("2999-01-01T00:00");

    fireEvent.submit(dateInput.closest("form")!);

    expect(
      await screen.findByText(/cannot be logged in the future/i),
    ).toBeInTheDocument();
    expect(onSubmitEvent).not.toHaveBeenCalled();
  });

  it("keeps the submit button disabled until an event type is chosen", () => {
    render(
      <LogEventScreen
        selectedDogId="dog-1"
        onSubmitEvent={vi.fn()}
        userIdInDB="user-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: /save event/i }),
    ).toBeDisabled();
  });
});
