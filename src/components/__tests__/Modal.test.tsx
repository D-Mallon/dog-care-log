import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Modal from "../Modal.tsx";

describe("Modal", () => {
  it("exposes dialog semantics and closes on the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal title="Delete event" description="Cannot be undone" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Delete event");
    expect(dialog).toHaveAccessibleDescription("Cannot be undone");

    await user.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and restores body scrolling", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { unmount } = render(
      <Modal title="Test" onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
