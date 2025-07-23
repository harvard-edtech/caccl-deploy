import {
  CloudFormationClient,
  DescribeStacksCommand,
  type Stack,
} from '@aws-sdk/client-cloudformation';

import getPaginatedResponseV2 from './getPaginatedResponseV2.js';

/**
 * Returns a list of available infrastructure stacks. It assumes
 * any CloudFormation stack with an output named `InfraStackName`
 * is a compatible stack.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} [profile='default'] AWS profile
 * @returns {string[]} name of all available CloudFormation infrastructure stacks
 */
const getInfraStackList = async (profile = 'default'): Promise<string[]> => {
  const client = new CloudFormationClient({ profile });
  const stacks = await getPaginatedResponseV2(async (_input) => {
    const command = new DescribeStacksCommand(_input);
    const res = await client.send(command);
    return {
      NextToken: res.NextToken,
      items: res.Stacks,
    };
  }, {});
  return stacks.flatMap((stack: Stack) => {
    if (stack.Outputs) {
      const outputKeys = stack.Outputs.map((output) => {
        return output.OutputKey;
      });
      if (outputKeys.includes('InfraStackName') && stack.StackName) {
        return stack.StackName;
      }
    }

    // Flat map 'filters' this out
    return [];
  });
};

export default getInfraStackList;
