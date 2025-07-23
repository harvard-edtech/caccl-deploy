import {
  CloudFormationClient,
  DescribeStacksCommand,
  type Output,
} from '@aws-sdk/client-cloudformation';
import { camelCase } from 'camel-case';

import CfnStackNotFound from '../../shared/errors/CfnStackNotFound.js';

/**
 * Returns an array of objects representing a Cloudformation stack's exports
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} stackName name of the stack whose exports we want to view.
 * @param {string} [profile='default'] AWS profile.
 * @returns {Record<string, string>} stack exports.
 */
const getCfnStackExports = async (
  stackName: string,
  profile = 'default',
): Promise<Record<string, string>> => {
  const client = new CloudFormationClient({ profile });
  // TODO: better typing
  let exports: Record<string, string> = {};
  try {
    const command = new DescribeStacksCommand({
      StackName: stackName,
    });
    const resp = await client.send(command);
    if (
      resp.Stacks === undefined ||
      resp.Stacks.length === 0 ||
      resp.Stacks[0] === undefined ||
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      throw new CfnStackNotFound(
        `Cloudformation stack ${stackName} does not exist`,
      );
    }

    throw error;
  }

  return exports;
};

export default getCfnStackExports;
