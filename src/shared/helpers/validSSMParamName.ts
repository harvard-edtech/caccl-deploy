/**
 * Test whether a name is a valid AWS Secret Store Manager parameter name.
 * @author Jay Luker
 * @param {string} name string which we are validating for use an SSM parameter name.
 * @returns {boolean} true if the string is valid, else false.
 */
const validSSMParamName = (name: string): boolean => {
  return /^([\w/:-]+)$/i.test(name);
};

export default validSSMParamName;
