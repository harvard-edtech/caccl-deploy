// Import aws-sdk
import AWS from 'aws-sdk';

// Import helpers
import getPaginatedResponse from './getPaginatedResponse.js';

/**
 * Returns a list of available infrastructure stacks. It assumes
 * any CloudFormation stack with an output named `InfraStackName`
 * is a compatible stack.
 * @author Jay Luker
 * @returns {string[]}
 */
const getInfraStackList = async (): Promise<string[]> => {
  const cfn = new AWS.CloudFormation();
  const stacks = await getPaginatedResponse(
    cfn.describeStacks.bind(cfn),
    {},
    'Stacks',
  );
  return stacks.flatMap((stack) => {
    if (stack.Outputs) {
      const outputKeys = stack.Outputs.map((output) => {
        return output.OutputKey;
      });
      if (outputKeys.includes('InfraStackName')) {
        return stack.StackName;
      }
    }

    // Flat map 'filters' this out
    return [];
  });
};

export default getInfraStackList;
