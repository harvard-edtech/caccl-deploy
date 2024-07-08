// Import aws-sdk
import AWS, { CloudFormation } from 'aws-sdk';

// Import helpers
import getPaginatedResponse from './getPaginatedResponse.js';

/**
 * Return a list of Cloudformation stacks with names matching a prefix
 * @param {string} stackPrefix
 * @returns {CloudFormation.Stack[]}
 */
const getCfnStacks = async (
  stackPrefix: string,
): Promise<CloudFormation.Stack[]> => {
  const cfn = new AWS.CloudFormation();
  const resp = await getPaginatedResponse(
    cfn.describeStacks.bind(cfn),
    {},
    'Stacks',
  );

  return resp.filter((s) => {
    return s.StackName.startsWith(stackPrefix);
  });
};

export default getCfnStacks;
