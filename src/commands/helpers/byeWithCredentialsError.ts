// Import helpers
import exitWithError from './exitWithError';

/**
 * Exit process with message indicating an issue with AWS credentials.
 * @author Jay Luker
 */
const byeWithCredentialsError = () => {
  exitWithError(
    [
      'Looks like there is a problem with your AWS credentials configuration.',
      'Did you run `aws configure`? Did you set a region? Default profile?',
    ].join('\n'),
  );
};

export default byeWithCredentialsError;
