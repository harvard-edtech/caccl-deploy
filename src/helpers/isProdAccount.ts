// Import aws
import { getAccountId } from '../aws/index.js';
// Import config
import { conf } from '../conf.js';

/**
 * Check whether the current AWS account is a production account.
 * @author Jay Luker
 * @returns boolean indicating whether it is a prod account.
 */
const isProdAccount = async () => {
  const prodAccounts = conf.get('productionAccounts');
  const accountId = await getAccountId();
  return prodAccounts && prodAccounts.includes(accountId);
};

export default isProdAccount;
