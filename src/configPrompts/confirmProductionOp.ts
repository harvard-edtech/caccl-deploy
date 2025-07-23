import chalk from 'chalk';
import figlet from 'figlet';

import type { CacclDeployContext } from '../types/CacclDeployContext.js';

import { getAccountId } from '../aws/index.js';
import logger from '../logger.js';
import UserCancel from '../shared/errors/UserCancel.js';
import confirm from './confirm.js';

/**
 * Confirm an operation that is being done on a production account.
 * Also checks if the current AWS account is a production account.
 * @author Jay Luker, Benedikt Arnarsson
 * @param {CacclDeployContext} context CACCL deploy CLI context.
 * @returns {Promise<boolean>} whether to execute the operation or not.
 */
const confirmProductionOp = async (
  context: CacclDeployContext,
): Promise<boolean> => {
  if (context.yes) {
    return true;
  }

  const prodAccounts = context.productionAccounts;
  if (prodAccounts === undefined || prodAccounts.length === 0) {
    return true;
  }

  const accountId = await getAccountId(context.profile);
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
