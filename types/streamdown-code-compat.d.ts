/**
 * @streamdown/code depends on shiki ^3 while the app resolves shiki ^4.
 * Their BundledLanguage unions diverge, so Streamdown's PluginConfig rejects
 * the vendor `code` plugin. Assert compatibility at the type boundary.
 *
 * Remove this file when @streamdown/code (or streamdown) supports shiki ^4 —
 * watch https://www.npmjs.com/package/@streamdown/code for a release that
 * drops the nested shiki 3 dependency, then delete this shim and re-run
 * `npm run type`.
 */
import type { CodeHighlighterPlugin } from "streamdown";

declare module "@streamdown/code" {
  export const code: CodeHighlighterPlugin;
}
