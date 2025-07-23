import {
  AddTagsToResourceCommand,
  PutParameterCommand,
  type PutParameterCommandInput,
  type PutParameterCommandOutput,
  SSMClient,
} from '@aws-sdk/client-ssm';

import type { AwsTag } from '../../shared/types/AwsTag.js';

/**
 * Add parameters to SSM.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {PutParameterCommandInput} opts - the parameter details, name, value, etc
 * @param {AwsTags[]} tags - aws resource tags
 * @param {string} [profile='default'] AWS profile
 * @returns {Promise<PutParameterCommandOutput>} return value of the put parameter command.
 */
const putSsmParameter = async (
  opts: PutParameterCommandInput,
  tags: AwsTag[] = [],
  profile = 'default',
): Promise<PutParameterCommandOutput> => {
  const client = new SSMClient({ profile });
  const paramOptions = { ...opts };

  const putParameterCommand = new PutParameterCommand(paramOptions);
  const paramResp = await client.send(putParameterCommand);
  if (tags.length > 0) {
    const addTagsCommand = new AddTagsToResourceCommand({
      ResourceId: paramOptions.Name,
      ResourceType: 'Parameter',
      Tags: tags,
    });
    await client.send(addTagsCommand);
  }

  return paramResp;
};

export default putSsmParameter;
