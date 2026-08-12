/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = path.join(root, 'scripts', process.platform === 'win32' ? 'code.bat' : 'code.sh');
const requiredPaths = [
	path.join(root, 'node_modules'),
	path.join(root, 'build', 'node_modules'),
];

const missing = requiredPaths.filter(candidate => !fs.existsSync(candidate));
if (missing.length > 0) {
	console.error('Grok Build IDE dependencies are not installed.');
	console.error('Run "npm install" in the repository root, then run "npm start" again.');
	process.exit(1);
}

if (!fs.existsSync(launcher)) {
	console.error(`Launcher not found: ${launcher}`);
	process.exit(1);
}

const child = spawn(launcher, process.argv.slice(2), {
	cwd: root,
	stdio: 'inherit',
	shell: process.platform === 'win32',
});

child.on('error', error => {
	console.error(`Failed to start Grok Build IDE: ${error.message}`);
	process.exit(1);
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 1);
});
