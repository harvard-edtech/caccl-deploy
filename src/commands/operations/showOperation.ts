import exitWithSuccess from '../helpers/exitWithSuccess';

const showOperation = async (cmd: any) => {
  // we only want to see that sha1 hash (likely for debugging)
  if (cmd.sha) {
    exitWithSuccess((await cmd.getDeployConfig()).toHash());
  }
  exitWithSuccess(
    (await cmd.getDeployConfig(cmd.keepSecretArns)).toString(true, cmd.flat),
  );
};

export default showOperation;
