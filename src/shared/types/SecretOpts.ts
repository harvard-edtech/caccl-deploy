/**
 * Type for the creation of secrets via SecretManager.
 * FIXME: look into whether this type is exposed via aws-sdk
 * @author Benedikt Arnarsson
 */
export type SecretOpts = {
  Description: string;
  Name: string;
  SecretString: string;
};
