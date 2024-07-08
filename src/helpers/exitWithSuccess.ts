// Import helpers
import bye from './bye.js';

/**
 * Exit the process with a message and a successful code.
 * @author Jay Luker
 * @param msg Message that will be printed on exit.
 */
const exitWithSuccess = (msg?: string) => {
  bye(msg);
};

export default exitWithSuccess;
