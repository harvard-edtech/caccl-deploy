/**
 * Exit the process with a message and code.
 * @author Jay Luker
 * @param msg Message to be printed.
 * @param exitCode exit status code.
 */
const bye = (msg = 'bye!', exitCode = 0) => {
  console.log(msg);
  process.exit(exitCode);
};

export default bye;
