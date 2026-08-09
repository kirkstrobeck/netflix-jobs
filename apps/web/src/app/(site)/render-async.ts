import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";

/**
 * The HTML a tree finally settles on, boundaries and all.
 *
 * renderToStaticMarkup -- what every other suite here uses -- is synchronous, so
 * a <Suspense> whose child awaits anything renders as its FALLBACK and the
 * assertion passes against markup no visitor is left looking at. Streaming and
 * waiting for allReady is the version that answers "what does the document say
 * once the server has finished", which for the wordmark is the whole question:
 * the fallback and the real mark differ only in one href.
 *
 * Both renders are worth having, so this does not replace the other one. A test
 * that wants the shell as it is first flushed still calls renderToStaticMarkup.
 */
export async function renderAsync(element: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element);

  await stream.allReady;

  return new Response(stream).text();
}
