import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';

const MAX_LOG_BYTES = 10 * 1024 * 1024;
let fileStream: fs.WriteStream | null = null;

function rotateIfNeeded(file: string): void {
  try {
    const { size } = fs.statSync(file);
    if (size > MAX_LOG_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    // Datei existiert noch nicht
  }
}

export function initFileLogging(): void {
  if (!config.logToFile || fileStream) return;
  const file = path.join(config.logDir, 'zauberbuch.log');
  rotateIfNeeded(file);
  fileStream = fs.createWriteStream(file, { flags: 'a' });
}

const silent = process.env.NODE_ENV === 'test';

function write(level: string, msg: string): void {
  if (silent && level !== 'ERROR') return;
  const line = `${new Date().toISOString()} [${level}] ${msg}`;
  (level === 'ERROR' ? console.error : console.log)(line);
  fileStream?.write(`${line}\n`);
}

export const logger = {
  info: (msg: string) => write('INFO', msg),
  warn: (msg: string) => write('WARN', msg),
  error: (msg: string, err?: unknown) =>
    write('ERROR', err instanceof Error ? `${msg}: ${err.stack ?? err.message}` : msg),
  /** Stream für morgan (Access-Log) */
  stream: {
    write: (line: string) => {
      process.stdout.write(line);
      fileStream?.write(line);
    },
  },
};
