// Import aws-sdk
import AWS from 'aws-sdk';

/**
 * checks that the AWS package interface has the configuration it needs
 * @author Jay Luker
 * @returns {boolean}
 */
const isConfigured = (): boolean => {
  try {
    return [AWS, AWS.config.credentials, AWS.config.region].every((thing) => {
      return thing !== undefined && thing !== null;
    });
  } catch {
    return false;
  }
};

export default isConfigured;
