import { useVimMode } from "./useVimModeSession";
import type { VimMode, VimModeSession } from "./VimModeSession";

/** Vim's own names, the same in every interface language. */
const VIM_MODE_LABELS = {
  normal: "NORMAL",
  insert: "INSERT",
  visual: "VISUAL",
} satisfies Record<VimMode, string>;

type VimModeLabelProps = {
  session: VimModeSession;
};

/** The mode the writing surface is in; nothing at all while Vim mode is off. */
export function VimModeLabel({ session }: VimModeLabelProps) {
  const mode = useVimMode(session);
  if (mode === null) {
    return null;
  }
  return (
    <span className="vim-mode-label" data-mode={mode}>
      {VIM_MODE_LABELS[mode]}
    </span>
  );
}
