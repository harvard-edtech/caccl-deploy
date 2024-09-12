// Import aws-sdk
import AWS from 'aws-sdk';

// Import logger
import Logger from '../../logger.js';

/**
 * Delete one or more parameter store entries
 * @param {string[]} paramNames
 */
const deleteSsmParameters = async (paramNames: string[]) => {
  const ssm = new AWS.SSM();
  const maxParams = 10;
  let idx = 0;
  while (idx < paramNames.length) {
    const paramNamesSlice = paramNames.slice(idx, maxParams + idx);
    idx += maxParams;
    await ssm
      .deleteParameters({
        Names: paramNamesSlice,
      })
      .promise();
    paramNamesSlice.forEach((name) => {
      Logger.log(`ssm parameter ${name} deleted`);
    });
  }
};

export default deleteSsmParameters;
