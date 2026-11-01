import type { Extension } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { Vim } from "@replit/codemirror-vim";

import type { ChannelResult } from "../../ipc/channelResult";
import type { ClipboardText } from "../../ipc/clipboardText";

type EngineRegister = ReturnType<typeof Vim.getRegisterController>["unnamedRegister"];
type InsertModeChanges = EngineRegister["insertModeChanges"][number];

export type SystemClipboardBackend = {
  readClipboardText: () => Promise<ChannelResult<ClipboardText>>;
  writeClipboardText: (text: string) => Promise<ChannelResult<null>>;
};

type RegisterContent = { text: string; linewise: boolean; blockwise: boolean };

const NOTHING: RegisterContent = { text: "", linewise: false, blockwise: false };

/**
 * Vim's unnamed register, shared with the system clipboard. Every text Vim
 * takes (yank, delete, change, a named register) goes out to the clipboard;
 * a plain paste answers whatever the clipboard held when it was last looked
 * at, so pasting never waits. The writer's own text keeps how Vim took it
 * (whole lines, a block); text from elsewhere is whole lines when it ends
 * with a line break. The black hole register never reaches this one.
 */
export class SystemClipboardRegister implements EngineRegister {
  readonly #backend: SystemClipboardBackend;
  #content: RegisterContent = NOTHING;
  #written: RegisterContent | null = null;
  #writesLanding: Promise<unknown> = Promise.resolve();
  insertModeChanges: InsertModeChanges[] = [];
  searchQueries: string[] = [];

  constructor(backend: SystemClipboardBackend) {
    this.#backend = backend;
  }

  get keyBuffer(): string[] {
    return [this.#content.text];
  }

  get linewise(): boolean {
    return this.#content.linewise;
  }

  get blockwise(): boolean {
    return this.#content.blockwise;
  }

  setText(text = "", linewise = false, blockwise = false): void {
    if (text === "") {
      return;
    }
    this.#write({ text, linewise, blockwise });
  }

  /** Only a macro being recorded into this register appends to it, one key at a time. */
  pushText(text: string): void {
    this.#write({ ...this.#content, text: this.#content.text + text, blockwise: false });
  }

  pushInsertModeChanges(changes: InsertModeChanges): void {
    this.insertModeChanges.push(changes);
  }

  pushSearchQuery(query: string): void {
    this.searchQueries.push(query);
  }

  clear(): void {
    this.#content = NOTHING;
    this.insertModeChanges = [];
    this.searchQueries = [];
  }

  toString(): string {
    return this.#content.text;
  }

  /** Looks at the clipboard once the writes so far have landed; an answer older than a later write is dropped. */
  async refresh(): Promise<void> {
    await this.#writesLanding;
    const writtenBefore = this.#written;
    const result = await this.#backend.readClipboardText();
    if (this.#written !== writtenBefore) {
      return;
    }
    const text = result.ok ? result.payload.text : null;
    if (text === null) {
      this.#content = NOTHING;
    } else if (text === this.#written?.text) {
      this.#content = this.#written;
    } else {
      this.#content = { text, linewise: text.endsWith("\n"), blockwise: false };
    }
  }

  /**
   * While installed, this is Vim's unnamed register, and the clipboard is
   * looked at again whenever another app may have changed it: Vim starting,
   * the window coming back, a copy or cut outside Vim.
   */
  extension(): Extension {
    return ViewPlugin.define(() => {
      const controller = Vim.getRegisterController();
      controller.unnamedRegister = this;
      controller.registers['"'] = this;
      const refresh = () => void this.refresh();
      const refreshAfterTheBrowserWrites = () => setTimeout(refresh);
      window.addEventListener("focus", refresh);
      document.addEventListener("copy", refreshAfterTheBrowserWrites);
      document.addEventListener("cut", refreshAfterTheBrowserWrites);
      refresh();
      return {
        destroy: () => {
          window.removeEventListener("focus", refresh);
          document.removeEventListener("copy", refreshAfterTheBrowserWrites);
          document.removeEventListener("cut", refreshAfterTheBrowserWrites);
        },
      };
    });
  }

  #write(content: RegisterContent): void {
    this.#content = content;
    this.#written = content;
    this.#writesLanding = Promise.all([this.#writesLanding, this.#backend.writeClipboardText(content.text)]);
  }
}
