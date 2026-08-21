import { copyFile, open, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2];
if (!directory) throw new Error('Pass an output directory.');

const text = value => new TextEncoder().encode(value);
await writeFile(join(directory, 'alive-corrupt.jpg'), new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 2, 3, 4]));
await writeFile(join(directory, 'alive-fake.png'), text('this is not a png'));
await writeFile(join(directory, 'alive-corrupt.wav'), text('RIFFxxxxWAVEbroken'));
await writeFile(join(directory, 'alive-corrupt.mp3'), new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, 1, 2, 3]));

const oversizedPng = new Uint8Array(33);
oversizedPng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const oversizedView = new DataView(oversizedPng.buffer);
oversizedView.setUint32(16, 20000);
oversizedView.setUint32(20, 4000);
await writeFile(join(directory, 'alive-oversized.png'), oversizedPng);

function wavHeader({ dataBytes, sampleRate = 44100, channels = 1, bits = 16 }) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const put = (offset, value) => [...value].forEach((character, index) => { bytes[offset + index] = character.charCodeAt(0); });
  const blockAlign = channels * bits / 8;
  put(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  put(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bits, true);
  put(36, 'data');
  view.setUint32(40, dataBytes, true);
  return bytes;
}

async function sparseWav(name, options) {
  const path = join(directory, name);
  const handle = await open(path, 'w');
  const header = wavHeader(options);
  await handle.write(header, 0, header.length, 0);
  await handle.truncate(44 + options.dataBytes);
  await handle.close();
}

await sparseWav('alive-long.wav', { dataBytes: 44100 * 2 * 601 });
await sparseWav('alive-desktop-limit.wav', { dataBytes: 44100 * 2 * 600 });
await sparseWav('alive-mobile-limit.wav', { dataBytes: 44100 * 2 * 240 });
await sparseWav('alive-memory-heavy.wav', { dataBytes: 192000 * 8 * 44, sampleRate: 192000, channels: 8, bits: 8 });
await sparseWav('alive-too-large.wav', { dataBytes: 101 * 1024 * 1024 });
await sparseWav('alive-valid.wav', { dataBytes: 44100 * 2 * 24 });
await sparseWav('alive-short.wav', { dataBytes: 44100 * 2 * 2 });
await copyFile(join(directory, 'alive-valid.jpg'), join(directory, 'alive-jpeg-disguised.png'));
await copyFile(join(directory, 'alive-valid.wav'), join(directory, 'alive-wav-disguised.mp3'));
