/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const product = JSON.parse(read('product.json'));
const extension = JSON.parse(read('extensions/grok-build-workbench/package.json'));
const packaging = JSON.parse(read('packaging.json'));
const version = read('build/grok/VERSION').trim();
const readme = read('README.md');
const readmeEn = read('README.en.md');
const activeScripts = [
	'scripts/grok-release/build-and-publish.ps1',
	'scripts/grok-release/Publish-ToDist.ps1',
	'scripts/build-grok-workbench-release.ps1',
	'scripts/build-grok-workbench-payload.ps1',
	'scripts/build-grok-workbench-single-exe.ps1',
].map(read).join('\n');

const failures = [];
if (version !== extension.version) {
	failures.push(`version mismatch: release=${version}, extension=${extension.version}`);
}
if (product.nameShort !== 'Grok Build IDE' || extension.displayName !== 'Grok Build IDE') {
	failures.push('product and extension display name must be Grok Build IDE');
}
if (packaging.versionSource !== 'build/grok/VERSION' || packaging.immutableVersions !== true) {
	failures.push('packaging contract must use build/grok/VERSION and immutable versions');
}
if (/H:\\projects/i.test(activeScripts)) {
	failures.push('active release scripts contain a fixed H:\\projects path');
}
if (/Invoke-Retention|Clear-OldBuilds/.test(activeScripts)) {
	failures.push('active release scripts must not prune releases or builds');
}
if (!/Required release artifact is missing/.test(activeScripts)) {
	failures.push('publisher must fail on incomplete channels');
}
if (!/PublicRelease requires an HTTPS/.test(activeScripts)) {
	failures.push('public release must require HTTPS');
}
if (!/Get-AuthenticodeSignature/.test(activeScripts)) {
	failures.push('public release must verify signatures');
}
if (!/Grok-Build-IDE-\$Version-win32-x64-portable/.test(activeScripts)) {
	failures.push('portable artifact name is not branded');
}
if (!/height:\s*100%/.test(read('extensions/grok-build-workbench/media/styles.css'))) {
	failures.push('webview app must fill viewport height');
}
if (extension.configurationDefaults?.['files.hotExit'] !== undefined) {
	failures.push('files.hotExit must live in the portable profile, not extension configurationDefaults');
}
const portableProfile = JSON.parse(read('build/grok/portable-profile/settings.json'));
if (portableProfile['files.hotExit'] !== 'onExitAndWindowClose') {
	failures.push('portable profile must preserve files.hotExit recovery');
}
const properties = extension.contributes?.configuration?.properties ?? {};
if (properties['grokBuild.defaultProduct']?.default !== 'grok-build-ide') {
	failures.push('Grok Build IDE must be the default product in the IDE package');
}
if (properties['grokBuild.agentFirstLayout']?.default !== false) {
	failures.push('agent-first desktop layout must be opt-in inside the IDE package');
}

const vietnameseLanguageSwitch = /<p align="center">\s*<a href="\.\/README\.en\.md">[^<]*English<\/a>\s*\|\s*<strong>[^<]+<\/strong>\s*<\/p>/;
const englishLanguageSwitch = /<p align="center">\s*<strong>[^<]*English<\/strong>\s*\|\s*<a href="\.\/README\.md">[^<]+<\/a>\s*<\/p>/;
if (!vietnameseLanguageSwitch.test(readme)) {
	failures.push('Vietnamese README must use the centered English | Vietnamese switch');
}
if (!englishLanguageSwitch.test(readmeEn)) {
	failures.push('English README must use the centered English | Vietnamese switch');
}
for (const [name, content] of [['Vietnamese README', readme], ['English README', readmeEn]]) {
	if (!content.includes(`**${version}**`)) {
		failures.push(`${name} must display current version ${version}`);
	}
}
const releaseUrlPattern = /https:\/\/github\.com\/nct88\/Grok-Build-IDE\/releases\/(?:download|tag)\/[^)\s]+/g;
const releaseUrls = content => [...new Set(content.match(releaseUrlPattern) || [])].sort();
if (JSON.stringify(releaseUrls(readme)) !== JSON.stringify(releaseUrls(readmeEn))) {
	failures.push('Vietnamese and English README release links must match exactly');
}
const sectionCount = content => (content.match(/^##\s+/gm) || []).length;
if (sectionCount(readme) !== sectionCount(readmeEn)) {
	failures.push(`README section count mismatch: vi=${sectionCount(readme)}, en=${sectionCount(readmeEn)}`);
}
if (readmeEn.length < readme.length * 0.75) {
	failures.push('English README appears incomplete');
}

if (failures.length) {
	console.error(failures.map(failure => `FAIL: ${failure}`).join('\n'));
	process.exit(1);
}
console.log(`Release contract OK (${version}): branded, immutable, bilingual README, complete channels, signed HTTPS public gate.`);
