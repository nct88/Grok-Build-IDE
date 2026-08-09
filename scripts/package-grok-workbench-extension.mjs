import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [extensionRootArgument, outputArgument] = process.argv.slice(2);
if (!extensionRootArgument || !outputArgument) {
	throw new Error('Usage: node package-grok-workbench-extension.mjs <extension-root> <output-vsix>');
}

const extensionRoot = path.resolve(extensionRootArgument);
const outputPath = path.resolve(outputArgument);

let pack;
try {
	const vscePath = 'H:/projects/grok-code/node_modules/@vscode/vsce/out/package.js';
	const vsceModule = await import(pathToFileURL(vscePath).href);
	pack = vsceModule.pack;
} catch {
	const requireFromExtension = createRequire(pathToFileURL(path.join(extensionRoot, 'package.json')));
	pack = requireFromExtension('@vscode/vsce/out/package').pack;
}

const result = await pack({
	cwd: extensionRoot,
	packagePath: outputPath,
	dependencies: false
});

console.log(`Packaged: ${result.packagePath} (${result.files.length} files)`);
