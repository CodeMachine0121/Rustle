import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { CompositionProvider } from "../../shared/composition/CompositionContext";
import { CompositionState } from "../../shared/composition/CompositionState";
import { ChipInput } from "./ChipInput";

type HarnessProps = { initialValues?: string[]; vocabulary?: string[] };

function Harness({ initialValues = [], vocabulary = [] }: HarnessProps) {
  const [values, setValues] = useState(initialValues);
  const [typed, setTyped] = useState("");
  return (
    <>
      <ChipInput
        label="Tags"
        values={values}
        typed={typed}
        vocabulary={vocabulary}
        onValuesChange={setValues}
        onTypedChange={setTyped}
      />
      <output aria-label="values">{JSON.stringify(values)}</output>
    </>
  );
}

function renderChipInput(props: HarnessProps = {}, composition = new CompositionState()) {
  render(
    <CompositionProvider state={composition}>
      <Harness {...props} />
    </CompositionProvider>,
  );
  const input = screen.getByLabelText("Tags");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("the chip field is not a text input");
  }
  return { input, composition };
}

function values(): string[] {
  return JSON.parse(screen.getByLabelText("values").textContent ?? "[]") as string[];
}

function type(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
}

describe("ChipInput", () => {
  it("turns the text into a chip on Enter and empties the field", () => {
    const { input } = renderChipInput();
    type(input, "技術筆記");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(values()).toEqual(["技術筆記"]);
    expect(input).toHaveValue("");
    expect(screen.getByText("技術筆記")).toBeInTheDocument();
  });

  it("turns the text into a chip on a comma", () => {
    const { input } = renderChipInput();
    type(input, "electron");

    fireEvent.keyDown(input, { key: "," });

    expect(values()).toEqual(["electron"]);
    expect(input).toHaveValue("");
  });

  it("removes the last chip on Backspace in an empty field", () => {
    const { input } = renderChipInput({ initialValues: ["tauri", "electron"] });

    fireEvent.keyDown(input, { key: "Backspace" });

    expect(values()).toEqual(["tauri"]);
  });

  it("keeps the chips on Backspace while the field has text", () => {
    const { input } = renderChipInput({ initialValues: ["tauri"] });
    type(input, "elec");

    fireEvent.keyDown(input, { key: "Backspace" });

    expect(values()).toEqual(["tauri"]);
  });

  it("removes only the chip whose remove button is clicked", () => {
    renderChipInput({ initialValues: ["技術筆記", "桌面開發"] });

    fireEvent.click(screen.getByRole("button", { name: "移除 技術筆記" }));

    expect(values()).toEqual(["桌面開發"]);
  });

  it("trims the chip and ignores text that is only spaces", () => {
    const { input } = renderChipInput();
    type(input, "  技術筆記  ");
    fireEvent.keyDown(input, { key: "Enter" });
    type(input, "   ");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(values()).toEqual(["技術筆記"]);
  });

  it("does not add a value twice but still empties the field", () => {
    const { input } = renderChipInput({ initialValues: ["electron"] });
    type(input, "electron");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(values()).toEqual(["electron"]);
    expect(input).toHaveValue("");
  });

  it("offers the workspace's words containing the typed text, ignoring case", () => {
    const { input } = renderChipInput({ vocabulary: ["Electron", "tauri"] });

    type(input, "elec");

    const candidates = screen.getByRole("list", { name: "Tags 候選" });
    expect(within(candidates).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Electron",
    ]);
  });

  it("offers nothing before anything is typed", () => {
    renderChipInput({ vocabulary: ["Electron"] });

    expect(screen.queryByRole("list", { name: "Tags 候選" })).not.toBeInTheDocument();
  });

  it("offers nothing when the workspace has no words", () => {
    const { input } = renderChipInput({ vocabulary: [] });

    type(input, "技");

    expect(screen.queryByRole("list", { name: "Tags 候選" })).not.toBeInTheDocument();
  });

  it("no longer offers a word that is already a chip", () => {
    const { input } = renderChipInput({ initialValues: ["技術筆記"], vocabulary: ["技術筆記"] });

    type(input, "技");

    expect(screen.queryByRole("list", { name: "Tags 候選" })).not.toBeInTheDocument();
  });

  it("turns a clicked candidate into a chip and empties the field", () => {
    const { input } = renderChipInput({ vocabulary: ["技術筆記"] });
    type(input, "技");

    fireEvent.click(screen.getByRole("button", { name: "技術筆記" }));

    expect(values()).toEqual(["技術筆記"]);
    expect(input).toHaveValue("");
  });

  it("leaves Enter to the input method while it is composing", () => {
    const { input } = renderChipInput();
    fireEvent.compositionStart(input);
    type(input, "ㄊㄞˊ");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(values()).toEqual([]);
    expect(input).toHaveValue("ㄊㄞˊ");
  });

  it("adds the chosen word on the Enter after the composition ends", () => {
    const { input } = renderChipInput();
    fireEvent.compositionStart(input);
    type(input, "台灣");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.compositionEnd(input);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(values()).toEqual(["台灣"]);
  });

  it("leaves an Enter that says it belongs to a composition to the input method", () => {
    const { input } = renderChipInput();
    type(input, "台");

    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: ",", keyCode: 229 });

    expect(values()).toEqual([]);
  });

  it("leaves Backspace to the input method while it is composing", () => {
    const { input } = renderChipInput({ initialValues: ["tauri"] });
    fireEvent.compositionStart(input);

    fireEvent.keyDown(input, { key: "Backspace" });

    expect(values()).toEqual(["tauri"]);
  });

  it("tells the shared state when a composition starts and ends", () => {
    const { input, composition } = renderChipInput();

    fireEvent.compositionStart(input);
    expect(composition.isComposing).toBe(true);

    fireEvent.compositionEnd(input);
    expect(composition.isComposing).toBe(false);
  });

  it("ends a composition whose end never came when the field loses focus", () => {
    const { input, composition } = renderChipInput();
    fireEvent.compositionStart(input);

    fireEvent.blur(input);

    expect(composition.isComposing).toBe(false);
  });
});
