// Import aws-sdk
import AWS, { CloudFormation } from 'aws-sdk';

// Import camel-case
import { camelCase } from 'camel-case';

// Import shared errors
import CfnStackNotFound from '../../shared/errors/CfnStackNotFound';

// Import

type Output = CloudFormation.Output;

/**
 * Returns an array of objects representing a Cloudformation stack's exports
 * @param {string} stackName
 * @returns {object[]}
 */
const getCfnStackExports = async (stackName: string) => {
  const cnf = new AWS.CloudFormation();
  // TODO: better typing
  let exports: Record<string, string> = {};
  try {
    const resp = await cnf
      .describeStacks({
        StackName: stackName,
      })
      .promise();
    if (
      resp.Stacks === undefined ||
      !resp.Stacks.length ||
      !resp.Stacks[0].Outputs
    ) {
      throw new CfnStackNotFound(`Unable to find stack ${stackName}`);
    }
    exports = resp.Stacks[0].Outputs.reduce(
      (obj: Record<string, string>, output: Output) => {
        if (!output.ExportName || !output.OutputValue) {
          return { ...obj };
        }
        const outputKey = camelCase(
          output.ExportName.replace(`${stackName}-`, ''),
        );
        return {
          ...obj,
          [outputKey]: output.OutputValue,
        };
      },
      {},
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) {
      throw new CfnStackNotFound(
        `Cloudformation stack ${stackName} does not exist`,
      );
    }
    throw err;
  }
  return exports;
};

export default getCfnStackExports;
