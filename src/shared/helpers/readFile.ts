// Import NodeJS libs
import fs from 'fs';
import path from 'path';

/**
 * Read a file into a string. Uses default utf8 encoding.
 * @author Jay Luker
 * @param filePath path to the file
 * @returns a string containing the files contents.
 */
const readFile = (filePath: string): string => {
  const resolvedPath = path.resolve(filePath);
  return fs.readFileSync(resolvedPath, 'utf8');
};

export default readFile;
