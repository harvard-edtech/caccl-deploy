/**
 * Simple module for flexibly setting a global logger.
 * @author Benedikt Arnarsson
 */

namespace logger {
  type LogFunction = (msg: string) => void;

  type Logger = { 
    log: LogFunction,
    error: LogFunction
  };

  let logger: Logger = {
    log: console.log,
    error: console.error,
  };

  /**
   * Set the log functions.
   * @author Benedikt Arnarsson
   * @param log function for standard logs.
   * @param error function for error logs.
   */
  export const setLogger = (log: LogFunction, error: LogFunction) => {
    logger.log = log;
    logger.error = error;
  } ;

  /**
   * Log a standard message to the set logger output.
   * Defaults to console.log.
   * @author Benedikt Arnarsson
   * @param msg string that will be pushed to the output.
   */
  export const log = (msg: string): void  => {
    logger.log(msg);
  };

  /**
   * Log an error message to the set logger output.
   * Defaults to console.error.
   * @author Benedikt Arnarsson
   * @param msg string that will be pushed to the output.
   */
  export const error = (msg: string): void => {
    logger.error(msg);
  };
}

export default logger;
