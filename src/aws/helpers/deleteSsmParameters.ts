// Import aws-sdk
import AWS from 'aws-sdk';

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
      console.log(`ssm parameter ${name} deleted`);
    });
  }
};

export default deleteSsmParameters;
