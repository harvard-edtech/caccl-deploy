// Import types
import AwsTag from '../types/AwsTag';

/**
 * Construct a list of AWS tags from a JS object. For passing into the aws-sdk library.
 * @author Jay Luker
 * @param tags a string-to-string object representing the AWS tags.
 * @returns a list of `AwsTag`s containing `Key` and `Value` properties.
 */
const tagsForAws = (tags: { [k: string]: string } = {}): AwsTag[] => {
  return Object.entries(tags).map(([k, v]) => {
    return { Key: k, Value: v };
  });
};

export default tagsForAws;
