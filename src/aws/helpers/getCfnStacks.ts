import {
  CloudFormationClient,
  DescribeStacksCommand,
  type Stack,
} from '@aws-sdk/client-cloudformation';

import getPaginatedResponseV2 from './getPaginatedResponseV2.js';

/**
 * Return a list of Cloudformation stacks with names matching a prefix.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {string} stackPrefix prefix to search for
 * @param {string} [profile='default'] AWS profile
 * @returns {Stack[]} all stack which match the prefix
 */
const getCfnStacks = async (
  stackPrefix: string,
  profile = 'default',
): Promise<Stack[]> => {
  const client = new CloudFormationClient({ profile });
  const resp = await getPaginatedResponseV2(async (_input) => {
    const command = new DescribeStacksCommand(_input);
    const res = await client.send(command);
    return {
      NextToken: res.NextToken,
      items: res.Stacks,
    };
  }, {});

  return resp.filter((s: Stack) => {
    return s.StackName && s.StackName.startsWith(stackPrefix);
  });
};

export default getCfnStacks;
