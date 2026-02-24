import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { LocalizedNumberInput } from "./localized-number-input";

describe("LocalizedNumberInput", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders an empty input when value is null", () => {
    render(<LocalizedNumberInput value={null} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("formats values using locale separators", () => {
    render(<LocalizedNumberInput value="1234.5" locale="de-DE" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("1.234,5");
  });

  it("emits canonical numeric string in onValueChange", () => {
    const onValueChange = vi.fn();

    render(<LocalizedNumberInput onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234" } });

    const callCount = onValueChange.mock.calls.length;
    expect(callCount > 0).toBe(true);

    const [value] = onValueChange.mock.calls[callCount - 1];
    expect(value).toBe("1234");
  });

  it("renders correctly in input-group-input mode", () => {
    render(<LocalizedNumberInput mode="input-group-input" value="10" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("10");
  });

  it("does not emit onValueChange for prop-driven value updates", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <LocalizedNumberInput value={10} onValueChange={onValueChange} />,
    );

    expect(onValueChange).toHaveBeenCalledTimes(0);

    rerender(<LocalizedNumberInput value={11} onValueChange={onValueChange} />);
    expect(onValueChange).toHaveBeenCalledTimes(0);
  });
});
