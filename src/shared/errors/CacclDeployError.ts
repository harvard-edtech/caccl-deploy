/**
 * Base error class for caccl-deploy.
 * @author Jay Luker
 */
class CacclDeployError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export default CacclDeployError;
