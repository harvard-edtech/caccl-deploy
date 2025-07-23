// Import types
import { type AwsTag } from '../types/AwsTag.js';

/**
 * Construct a list of AWS tags from a JS object. For passing into the aws-sdk library.
 * @author Jay Luker
 * @param {Record<string, string>} [tags={}] a string-to-string object representing the AWS tags.
 * @returns {AwsTag[]} a list of `AwsTag`s containing `Key` and `Value` properties.
 */
const tagsForAws = (tags: Record<string, string> = {}): AwsTag[] => {
  return Object.entries(tags).map(([k, v]) => {
    return { Key: k, Value: v };
  });
};

export default tagsForAws;
