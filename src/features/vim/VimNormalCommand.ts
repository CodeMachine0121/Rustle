/** Something the app does when the writer types `keys` in Vim's Normal mode, in place of Vim's own meaning there. */
export type VimNormalCommand = {
  keys: string;
  run: () => void;
};
