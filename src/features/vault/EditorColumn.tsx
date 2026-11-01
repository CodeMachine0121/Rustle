import { MarkdownEditor } from "../editor/MarkdownEditor";
import type { VaultSnapshot } from "./VaultSession";

type EditorColumnProps = {
  snapshot: VaultSnapshot;
};

export function EditorColumn({ snapshot }: EditorColumnProps) {
  const { body, indentation, bodyFailure } = snapshot;
  if (bodyFailure !== null) {
    return (
      <p className="column-message" role="alert">
        讀不到這篇文章：{bodyFailure}
      </p>
    );
  }
  if (body === null) {
    return <p className="empty-state">選一篇文章開始寫作</p>;
  }
  return <MarkdownEditor body={body} indentation={indentation} />;
}
