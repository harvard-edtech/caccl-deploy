/**
 * Type for the creation of secrets via SecretManager.
 * FIXME: look into whether this type is exposed via aws-sdk
 * @author Benedikt Arnarsson
 */
type SecretOpts = {
  Name: string;
  Description: string;
  SecretString: string;
};

export default SecretOpts;
