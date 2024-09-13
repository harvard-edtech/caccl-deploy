import AWS, { SSM } from 'aws-sdk';

import AwsTag from '../../shared/types/AwsTag.js';

/**
 * Add parameters to SSM
 * @author Jay Luker
 * @param {SSM.PutParameterRequest} opts - the parameter details, name, value, etc
 * @param {object[]} tags - aws resource tags
 * @returns {object}
 */
const putSsmParameter = async (
  opts: SSM.PutParameterRequest,
  tags: AwsTag[] = [],
) => {
  const ssm = new AWS.SSM();
  const paramOptions = { ...opts };

  const paramResp = await ssm.putParameter(paramOptions).promise();
  if (tags.length > 0) {
    await ssm
      .addTagsToResource({
        ResourceId: paramOptions.Name,
        ResourceType: 'Parameter',
        Tags: tags,
      })
      .promise();
  }

  return paramResp;
};

export default putSsmParameter;
