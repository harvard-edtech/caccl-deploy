// Import chalk
import chalk from 'chalk';

// Import figlet
import figlet from 'figlet';

// Import aws
import confirm from './confirm';
import { getAccountId } from '../aws';

// Import conf
import { conf } from '../conf';

// Import shared errors
import UserCancel from '../shared/errors/UserCancel';

// Import helpers

const confirmProductionOp = async (yes?: boolean) => {
  if (yes) {
    return true;
  }
  const prodAccounts = conf.get('productionAccounts');
  if (prodAccounts === undefined || !prodAccounts.length) {
    return true;
  }
  const accountId = await getAccountId();
  if (!prodAccounts.includes(accountId)) {
    return true;
  }
  console.log(chalk.redBright(figlet.textSync('Production Account!')));
  try {
    const ok = await confirm('\nPlease confirm you wish to proceed\n');
    return ok;
  } catch (err) {
    if (err instanceof UserCancel) {
      return false;
    }
    throw err;
  }
};

export default confirmProductionOp;
