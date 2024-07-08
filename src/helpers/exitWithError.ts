// Import helpers
import bye from './bye.js';

/**
 * Exit the process with a message and an error status code.
 * @author Jay Luker
 * @param msg Message that will be printed on exit.
 */
const exitWithError = (msg?: string) => {
  bye(msg, 1);
};

export default exitWithError;
