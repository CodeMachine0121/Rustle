import { describeOperationFailure, type OperationFailure } from "./operationFailure";

type OperationFailureNoticeProps = {
  failure: OperationFailure | null;
  onDismiss: () => void;
};

export function OperationFailureNotice({ failure, onDismiss }: OperationFailureNoticeProps) {
  if (failure === null) {
    return null;
  }
  return (
    <div className="operation-failure-notice" role="alert">
      <span>{describeOperationFailure(failure)}</span>
      <button type="button" className="region-action" onClick={onDismiss}>
        關閉提示
      </button>
    </div>
  );
}
