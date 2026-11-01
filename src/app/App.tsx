import { useEffect, useState } from "react";

import { AutosavedEditor } from "../features/autosave/AutosavedEditor";
import { AutosaveSession } from "../features/autosave/AutosaveSession";
import { watchWindowCloseRequests } from "../features/autosave/watchWindowCloseRequests";
import { SAMPLE_BODY } from "../features/editor/sampleBody";
import { channels } from "../ipc/channels";
import { CompositionProvider, useCompositionState } from "../shared/composition/CompositionContext";

export function App() {
  return (
    <CompositionProvider>
      <main className="app">
        <WritingArea />
      </main>
    </CompositionProvider>
  );
}

function WritingArea() {
  const composition = useCompositionState();
  const [session] = useState(
    () => new AutosaveSession(composition, channels, { releaseFocus: blurFocusedElement }),
  );

  useEffect(() => {
    void watchWindowCloseRequests(session, channels);
    return () => session.dispose();
  }, [session]);

  return <AutosavedEditor session={session} placeholderBody={SAMPLE_BODY} />;
}

// Losing focus makes the input method commit its composition and end it.
function blurFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
