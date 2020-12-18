class CacclDeployError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class AwsProfileNotFound extends CacclDeployError {}

class AppNotFound extends CacclDeployError {}

class ExistingSecretWontDelete extends CacclDeployError {}

class CfnStackNotFound extends CacclDeployError {}

class UserCancel extends CacclDeployError {}

class NoPromptChoices extends CacclDeployError {}

module.exports = {
  AwsProfileNotFound,
  AppNotFound,
  ExistingSecretWontDelete,
  CfnStackNotFound,
  UserCancel,
  NoPromptChoices,
};
