/**
 * Simple module for flexibly setting a global logger.
 * @author Benedikt Arnarsson
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace logger {
  type LogFunction = (_msg: string) => void;

  type Logger = {
    error: LogFunction;
    log: LogFunction;
  };

  const _logger: Logger = {
    error: console.error,
    log: console.log,
  };

  /**
   * Set the log functions.
   * @author Benedikt Arnarsson
   * @param log function for standard logs.
   * @param error function for error logs.
   * @returns {void}
   */
  export const setLogger = (log: LogFunction, error: LogFunction) => {
    _logger.log = log;
    _logger.error = error;
  };

  /**
   * Log a standard message to the set logger output.
   * Defaults to console.log.
   * @author Benedikt Arnarsson
   * @param msg string that will be pushed to the output.
   * @returns {void}
   */
  export const log = (msg: string): void => {
    _logger.log(msg);
  };

  /**
   * Log an error message to the set logger output.
   * Defaults to console.error.
   * @author Benedikt Arnarsson
   * @param msg string that will be pushed to the output.
   * @returns {void}
   */
  export const error = (msg: string): void => {
    _logger.error(msg);
  };
}

export default logger;
