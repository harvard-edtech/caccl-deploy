import { getAccountId } from '../aws/index.js';
import { type CacclDeployContext } from '../types/CacclDeployContext.js';

/**
 * Check whether the current AWS account is a production account.
 * @author Jay Luker
 * @param {CacclDeployContext} context the CACCL deploy context.
 * @returns {boolean} whether the current AWS account is a prod account.
 */
const isProdAccount = async (context: CacclDeployContext) => {
  const prodAccounts = context.productionAccounts;
  const accountId = await getAccountId(context.profile);
  return prodAccounts && prodAccounts.includes(accountId);
};

export default isProdAccount;
