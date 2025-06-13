/**
 * Create a promise which resolves in a set number of milliseconds.
 * @author Jay Luker
 * @param {number} ms number of milliseconds before the promise will resolve.
 * @returns {Promise<void>} Promise which will resolve in `ms` milliseconds.
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export default sleep;
