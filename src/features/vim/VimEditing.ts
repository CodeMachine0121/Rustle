import { Compartment, EditorState, Facet, Prec, type Extension, type StateEffect } from "@codemirror/state";
import { EditorView, ViewPlugin, keymap, runScopeHandlers, type Command, type KeyBinding } from "@codemirror/view";
import { getCM, Vim, vim, type CM5EditorInterface, type CodeMirrorV } from "@replit/codemirror-vim";

import type { CompositionState } from "../../shared/composition/CompositionState";
import { escapeRouteClosed } from "../editor/TabIndentation";
import type { SystemClipboardRegister } from "./SystemClipboardRegister";
import type { VimMode } from "./VimModeSession";
import type { VimNormalCommand } from "./VimNormalCommand";

/** Keys the editor owns while typing; with Vim on they run after Vim, under this scope. */
const TYPING_SCOPE = "rustleTyping";

/** The engine's key map is shared by every editor; each editor answers a mapped key with its own command. */
const normalCommands = Facet.define<VimNormalCommand>();
const keysMappedInTheEngine = new Set<string>();

type VimModeChange = { mode: string };

/**
 * Vim in one editor, in three bands. Every key the app owns runs first,
 * through the editor's own keymap. Vim comes next. Last come the keys the
 * editor owns only while typing (`typingKeys`): in Insert mode they do what
 * they always did; in Normal and Visual mode they do nothing, so no key falls
 * through to an edit Vim did not ask for. With Vim off the typing keys are
 * the very same keymap, in the very same place, as without this class.
 *
 * Esc is Vim's own: back to Normal from Insert or Visual once the snippet
 * menu and fields had their turn, and left to the rest of the app in Normal;
 * it never opens the editor's Esc-then-Tab way out, so Tab always indents.
 * A selection always means Visual, even one made while typing, except the
 * one an input method draws over the candidate being chosen. While an input
 * method composes in Insert mode the key is the input method's: Vim never
 * sees it. Given a `SystemClipboardRegister`, Vim's unnamed register
 * is the system clipboard while Vim is on.
 *
 * Each `VimNormalCommand` takes its keys in Normal mode only, and never while
 * an input method composes; Insert and Visual keep what those keys always did.
 */
export class VimEditing {
  readonly #composition: CompositionState;
  readonly #register: SystemClipboardRegister | undefined;
  readonly #normalCommands: readonly VimNormalCommand[];
  #reportMode: (mode: VimMode) => void = () => {};
  readonly #vimSlot = new Compartment();
  readonly #typingSlots = new Map<readonly KeyBinding[], Compartment>();
  #isEnabled: boolean;

  constructor(
    composition: CompositionState,
    isEnabled: boolean,
    register?: SystemClipboardRegister,
    commands: readonly VimNormalCommand[] = [],
  ) {
    this.#composition = composition;
    this.#isEnabled = isEnabled;
    this.#register = register;
    this.#normalCommands = commands;
    for (const { keys } of commands) {
      if (keysMappedInTheEngine.has(keys)) {
        continue;
      }
      keysMappedInTheEngine.add(keys);
      const action = `rustle ${keys}`;
      Vim.defineAction(action, (editor) => {
        const view: EditorView = editor.cm6;
        view.state.facet(normalCommands).find((command) => command.keys === keys)?.run();
      });
      Vim.mapCommand(keys, "action", action, {}, { context: "normal" });
    }
  }

  /** Every mode the editor enters from now on, starting with Normal each time Vim starts. */
  reportModesTo(listener: (mode: VimMode) => void): void {
    this.#reportMode = listener;
  }

  extension(): Extension {
    return this.#vimSlot.of(this.#vimBand());
  }

  typingKeys(bindings: readonly KeyBinding[]): Extension {
    const slot = this.#typingSlots.get(bindings) ?? new Compartment();
    this.#typingSlots.set(bindings, slot);
    return slot.of(this.#typingKeymap(bindings));
  }

  /** The effects that turn Vim on or off in place: the text, cursor and undo history stay. */
  switchTo(isEnabled: boolean): StateEffect<unknown>[] {
    this.#isEnabled = isEnabled;
    return [
      this.#vimSlot.reconfigure(this.#vimBand()),
      ...[...this.#typingSlots].map(([bindings, slot]) => slot.reconfigure(this.#typingKeymap(bindings))),
    ];
  }

  #isTyping(view: EditorView): boolean {
    return getCM(view)?.state.vim?.insertMode === true;
  }

  #typingKeymap(bindings: readonly KeyBinding[]): Extension {
    if (!this.#isEnabled) {
      return keymap.of(bindings);
    }
    const whileTyping = (command: Command | undefined, preventDefault: boolean): Command | undefined =>
      command && ((view) => (this.#isTyping(view) ? command(view) || preventDefault : true));
    return keymap.of(
      bindings
        .filter((binding) => binding.key !== "Escape")
        .map((binding) => ({
          key: binding.key,
          mac: binding.mac,
          win: binding.win,
          linux: binding.linux,
          scope: TYPING_SCOPE,
          run: whileTyping(binding.run, binding.preventDefault === true),
          shift: whileTyping(binding.shift, binding.preventDefault === true),
        })),
    );
  }

  #vimBand(): Extension {
    if (!this.#isEnabled) {
      return [];
    }
    const reportMode = (mode: VimMode) => this.#reportMode(mode);
    const composition = this.#composition;
    return [
      ViewPlugin.define((view) => {
        const keepFromVim = (event: KeyboardEvent) => {
          if (composition.ownsKey(event) && this.#isTyping(view)) {
            event.stopPropagation();
          }
        };
        view.dom.addEventListener("keydown", keepFromVim, { capture: true });
        return { destroy: () => view.dom.removeEventListener("keydown", keepFromVim, { capture: true }) };
      }),
      escapeRouteClosed.of(true),
      // Visual block mode is one selection per line it covers.
      EditorState.allowMultipleSelections.of(true),
      Prec.low(vim()),
      this.#register?.extension() ?? [],
      this.#normalCommands.map(({ keys, run }) =>
        normalCommands.of({
          keys,
          run: () => {
            if (!composition.isComposing) {
              run();
            }
          },
        }),
      ),
      Prec.low(
        ViewPlugin.define((view) => {
          const editor = getCM(view);
          const reportChange = ({ mode }: VimModeChange) => {
            if (mode === "insert" || mode === "replace") {
              reportMode("insert");
            } else {
              reportMode(mode.startsWith("visual") ? "visual" : "normal");
            }
          };
          editor?.on("vim-mode-change", reportChange);
          reportMode("normal");
          return {
            update: (update) => {
              const selected = update.transactions.some((transaction) => transaction.isUserEvent("select"));
              const isComposing = composition.isComposing || update.view.compositionStarted;
              const selectsWhileTyping = selected && !isComposing && !update.state.selection.main.empty;
              if (editor !== null && isVimEditor(editor) && editor.state.vim.insertMode && selectsWhileTyping) {
                editor.operation(() => {
                  Vim.exitInsertMode(editor, true);
                  editor.onSelectionChange();
                });
              }
            },
            destroy: () => editor?.off("vim-mode-change", reportChange),
          };
        }),
      ),
      Prec.lowest(
        EditorView.domEventHandlers({
          keydown: (event, view) => runScopeHandlers(view, event, TYPING_SCOPE),
        }),
      ),
    ];
  }
}

function isVimEditor(editor: CM5EditorInterface): editor is CodeMirrorV {
  return editor.state.vim !== null && editor.state.vim !== undefined;
}
