import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { describeOperationFailure, type OperationFailure } from "./operationFailure";

type OperationFailureNoticeProps = {
  failure: OperationFailure | null;
  onDismiss: () => void;
};

export function OperationFailureNotice({ failure, onDismiss }: OperationFailureNoticeProps) {
  const messages = useMessages();
  if (failure === null) {
    return null;
  }
  return (
    <div className="operation-failure-notice" role="alert">
      <span>{describeOperationFailure(failure, messages)}</span>
      <button type="button" className="region-action" onClick={onDismiss}>
        {messages.dismiss}
      </button>
    </div>
  );
}
