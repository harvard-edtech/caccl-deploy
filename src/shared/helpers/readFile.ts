import fs from 'node:fs';
import path from 'node:path';

/**
 * Read a file into a string. Uses default utf8 encoding.
 * @author Jay Luker
 * @param {string} filePath path to the file
 * @returns {string} a string containing the files contents.
 */
const readFile = (filePath: string): string => {
  const resolvedPath = path.resolve(filePath);
  return fs.readFileSync(resolvedPath, 'utf8');
};

export default readFile;
