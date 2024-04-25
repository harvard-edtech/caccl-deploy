// Import aws
import { getAccountId } from '../../../lib/aws';

// Import config
import { conf } from '../../conf';

const isProdAccount = async () => {
  const prodAccounts = conf.get('productionAccounts');
  const accountId = await getAccountId();
  return prodAccounts && prodAccounts.includes(accountId);
};

export default isProdAccount;
