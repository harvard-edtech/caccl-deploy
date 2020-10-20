class CacclDeployError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class AppNotFound extends CacclDeployError {}

class ExistingSecretWontDelete extends CacclDeployError {}

class CfnStackNotFound extends CacclDeployError {}

class UserCancel extends CacclDeployError {}

module.exports = {
  AppNotFound,
  ExistingSecretWontDelete,
  CfnStackNotFound,
  UserCancel,
};
