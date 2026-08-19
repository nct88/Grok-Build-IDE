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
const security = read('SECURITY.md');
const contributing = read('CONTRIBUTING.md');
const support = read('SUPPORT.md');
const privacy = read('docs/PRIVACY.md');
const dependencySecurity = read('docs/DEPENDENCY_SECURITY.md');
const installer = read('build/grok/setup-installer/GrokBuildIDE.iss');
const portableSettingsVerifier = read('scripts/verify-grok-workbench-portable-settings.ps1');
const activeScripts = [
	'scripts/grok-release/build-and-publish.ps1',
	'scripts/grok-release/Publish-ToDist.ps1',
	'scripts/grok-release/Publish-GitHubRelease.ps1',
	'scripts/grok-release/Build-CodeOssBase.ps1',
	'scripts/grok-release/Test-CodeOssBaseProvenance.ps1',
	'scripts/grok-release/Sign-WindowsArtifacts.ps1',
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
if (packaging.githubRepo !== 'nct88/Grok-Build-IDE') {
	failures.push('packaging.json githubRepo must be nct88/Grok-Build-IDE');
}
if (packaging.siblingRepo !== 'nct88/Grok-Build-Desktop') {
	failures.push('packaging.json siblingRepo must be nct88/Grok-Build-Desktop');
}
if (!/nct88\/Grok-Build-Desktop/.test(readme + readmeEn)) {
	failures.push('README must identify the sibling Grok Build Desktop repository');
}
if (/github\.com\/nct88\/Grok-Build(?!-Desktop)(?!-IDE)/.test(readme + readmeEn)) {
	failures.push('README must not use the retired nct88/Grok-Build GitHub path');
}
if (/repository private/i.test(readme + readmeEn)) {
	failures.push('README must not claim the public GitHub repository is private');
}
if (/Grok Build CLI/.test(contributing + support + security + privacy)) {
	failures.push('docs must say Grok CLI, not Grok Build CLI');
}
if (product.licenseFileName !== 'LICENSE.txt') {
	failures.push('product packaging must include the repository LICENSE.txt');
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
if (!/\.staging-/.test(activeScripts) || !/Move-Item -LiteralPath \$versionRoot -Destination \$finalVersionRoot/.test(activeScripts)) {
	failures.push('publisher must stage a complete version before atomically promoting it');
}
if (!/PublicRelease requires an HTTPS/.test(activeScripts)) {
	failures.push('public release must require HTTPS');
}
if (!/Get-AuthenticodeSignature/.test(activeScripts)) {
	failures.push('public release must verify signatures');
}
if (!/AllowUnsignedPublicRelease/.test(activeScripts) || !/public-unsigned/.test(activeScripts) || !/waiver/.test(activeScripts)) {
	failures.push('unsigned public publication must require an explicit, truthful waiver');
}
if (!/PublicRelease requires an explicit -BaseCandidateRoot/.test(activeScripts)) {
	failures.push('public release must require an explicit reviewed base candidate');
}
if (!/source Git commit/.test(activeScripts) || !/base product SHA-256/.test(activeScripts)) {
	failures.push('public release manifest must require source and base provenance');
}
if (!/base package version .* does not match source package version/.test(activeScripts)) {
	failures.push('public release must reject a base package built from a different source version');
}
if (!/\.grok-base-provenance\.json/.test(activeScripts) || !/verified-clean-base/.test(activeScripts)) {
	failures.push('Code OSS bases must carry verifiable clean-source provenance');
}
if (!/Base executable SHA-256/.test(activeScripts) || !/BASE-PROVENANCE\.json/.test(activeScripts)) {
	failures.push('public release must publish and verify executable/base provenance');
}
if (!/Sign-WindowsArtifacts\.ps1/.test(activeScripts) || !/TimeStamperCertificate/.test(activeScripts) || !/signerThumbprint/.test(activeScripts)) {
	failures.push('release pipeline must sign and timestamp newly built Windows artifacts');
}
if (!/test-update-lifecycle\.ps1/.test(activeScripts) || !/test-windows-installer-lifecycle\.ps1/.test(activeScripts)) {
	failures.push('release pipeline must execute updater and isolated Windows installer lifecycle tests');
}
if (!/Copy-TreeRobust/.test(activeScripts) || !/robocopy/.test(activeScripts)) {
	failures.push('payload packaging must support long Windows dependency paths');
}
if (!/hash-verified-atomic-with-backup/.test(activeScripts) || !/rollback-update\.ps1/.test(activeScripts)) {
	failures.push('dist update channel must publish atomic apply and rollback metadata');
}
const updater = read('scripts/templates/apply-update.ps1');
const rollback = read('scripts/templates/rollback-update.ps1');
if (!/VSIX SHA-256 mismatch/.test(updater) || !/GROK_UPDATE_TEST_FAIL_AFTER_REGISTRY_SWAP/.test(updater)) {
	failures.push('updater must verify SHA-256 and support transactional failure testing');
}
if (!/transaction\.json/.test(rollback) || !/rolled-back/.test(rollback)) {
	failures.push('published updater must include explicit transaction rollback');
}
if (!/gh run watch/.test(activeScripts) || !/--exit-status/.test(activeScripts)) {
	failures.push('GitHub publisher must wait for release validation before publication');
}
if (!/test:real-grok/.test(activeScripts)) {
	failures.push('GitHub publisher must run the authenticated real-Grok ACP smoke test');
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
if (portableProfile['security.workspace.trust.enabled'] !== true) {
	failures.push('portable profile must keep Workspace Trust enabled');
}
if (!/'security\.workspace\.trust\.enabled'\s*=\s*\$true/.test(portableSettingsVerifier)) {
	failures.push('portable release verifier must require Workspace Trust enabled');
}
if (properties['grokBuild.enableTerminal']?.default !== false) {
	failures.push('ACP reverse-terminal must be disabled by default');
}
if (extension.capabilities?.untrustedWorkspaces?.supported !== false) {
	failures.push('extension must declare untrusted workspaces unsupported');
}
if (!/requires Workspace Trust/i.test(properties['grokBuild.enableTerminal']?.markdownDescription ?? '')) {
	failures.push('terminal setting must explain its Workspace Trust requirement');
}
if (!/security\/advisories\/new/.test(security) || /aka\.ms\/SECURITY\.md/.test(security)) {
	failures.push('SECURITY.md must use the Grok Build IDE private reporting channel');
}
if (!/github\.com\/nct88\/Grok-Build-IDE\/issues/.test(contributing + support)) {
	failures.push('contribution and support docs must route to the Grok Build IDE repository');
}
if (!/Session transcripts/.test(privacy)) {
	failures.push('privacy documentation must cover session transcript handling');
}
if (!/three moderate findings/.test(dependencySecurity) || !/zero production/.test(dependencySecurity)) {
	failures.push('dependency security status must document root exceptions and extension audit state');
}
if (/github\.com\/microsoft\/vscode/.test(installer)) {
	failures.push('installer support/update metadata must not point to Microsoft VS Code');
}
if (product.reportIssueUrl !== 'https://github.com/nct88/Grok-Build-IDE/issues/new/choose') {
	failures.push('product issue URL must point to Grok Build IDE');
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
console.log(`Release contract OK (${version}): branded, immutable, bilingual README, complete channels, HTTPS public gate with signed default or explicit unsigned waiver.`);
