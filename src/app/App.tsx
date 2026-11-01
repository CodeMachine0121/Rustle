import { MarkdownEditor } from "../features/editor/MarkdownEditor";
import { SAMPLE_BODY } from "../features/editor/sampleBody";
import { CompositionProvider } from "../shared/composition/CompositionContext";

export function App() {
  return (
    <CompositionProvider>
      <main className="app">
        <MarkdownEditor body={SAMPLE_BODY} />
      </main>
    </CompositionProvider>
  );
}
