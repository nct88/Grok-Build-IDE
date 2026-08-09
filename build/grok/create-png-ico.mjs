/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'node:fs';
import path from 'node:path';

const [, , outputPath, ...inputPaths] = process.argv;
if (!outputPath || inputPaths.length === 0) {
	throw new Error('Usage: node create-png-ico.mjs <output.ico> <input.png> [...]');
}

const images = inputPaths.map(inputPath => {
	const match = /(?:^|[^0-9])(\d{1,3})x\1(?:[^0-9]|$)/.exec(path.basename(inputPath));
	if (!match) {
		throw new Error(`PNG filename must include a square size such as 32x32: ${inputPath}`);
	}
	const size = Number(match[1]);
	if (size < 1 || size > 256) {
		throw new Error(`ICO image size must be between 1 and 256: ${inputPath}`);
	}
	return { size, data: fs.readFileSync(inputPath) };
});

const headerSize = 6 + (16 * images.length);
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let imageOffset = headerSize;
for (let index = 0; index < images.length; index++) {
	const image = images[index];
	const entryOffset = 6 + (16 * index);
	header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset);
	header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1);
	header.writeUInt8(0, entryOffset + 2);
	header.writeUInt8(0, entryOffset + 3);
	header.writeUInt16LE(1, entryOffset + 4);
	header.writeUInt16LE(32, entryOffset + 6);
	header.writeUInt32LE(image.data.length, entryOffset + 8);
	header.writeUInt32LE(imageOffset, entryOffset + 12);
	imageOffset += image.data.length;
}

fs.writeFileSync(outputPath, Buffer.concat([header, ...images.map(image => image.data)]));
