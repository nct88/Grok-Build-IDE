import * as vscode from "vscode";

/**
 * Local snippet-only inline completions (NOT AI / NOT ACP).
 * Disabled by default via `grokBuild.localSnippetCompletions`.
 * Do not market this as Grok ghost-text intelligence.
 */
export class GrokInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.InlineCompletionList | vscode.InlineCompletionItem[]> {
    const enabled = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("localSnippetCompletions", false);
    if (!enabled) {
      return [];
    }

    const linePrefix = document.lineAt(position).text.slice(0, position.character);

    if (linePrefix.endsWith("console.log(")) {
      return [
        new vscode.InlineCompletionItem('"grok:", ', new vscode.Range(position, position)),
      ];
    }

    if (linePrefix.endsWith("function ") || linePrefix.endsWith("async function ")) {
      return [
        new vscode.InlineCompletionItem("grokHandler() {\n  \n}", new vscode.Range(position, position)),
      ];
    }

    return [];
  }
}
