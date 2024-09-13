// Import chalk
import chalk from 'chalk';
// Import figlet
import figlet from 'figlet';

import { getAccountId } from '../aws/index.js';
// Import conf
import { conf } from '../conf.js';
// Import logger
import logger from '../logger.js';
import UserCancel from '../shared/errors/UserCancel.js';
import confirm from './confirm.js';
// Import shared errors
// Import aws

const confirmProductionOp = async (yes?: boolean) => {
  if (yes) {
    return true;
  }

  const prodAccounts = conf.get('productionAccounts');
  if (prodAccounts === undefined || prodAccounts.length === 0) {
    return true;
  }

  const accountId = await getAccountId();
  if (!prodAccounts.includes(accountId)) {
    return true;
  }

  logger.log(chalk.redBright(figlet.textSync('Production Account!')));
  try {
    const ok = await confirm('\nPlease confirm you wish to proceed\n');
    return ok;
  } catch (error) {
    if (error instanceof UserCancel) {
      return false;
    }

    throw error;
  }
};

export default confirmProductionOp;
