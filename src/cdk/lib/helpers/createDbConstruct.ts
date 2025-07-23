// Import constructs
import { Construct } from 'constructs';

// Import shared types
import { type CacclDbProps } from '../../../types/index.js';

// Import classes
import CacclDocDb from '../classes/CacclDocDb.js';
import CacclRdsDb from '../classes/CacclRdsDb.js';

/**
 * factory method for creating either a DocDb or RdsDb construct
 *
 * @param scope the standard app scope arg
 * @param props props for creating the cluster construct
 * @returns either a CacclDocDb or CacclRdsDb
 */
const createDbConstruct = (scope: Construct, props: CacclDbProps) => {
  const { options } = props;
  switch (options.engine.toLowerCase()) {
    case 'docdb': {
      return new CacclDocDb(scope, 'DocDb', props);
    }

    case 'mysql': {
      return new CacclRdsDb(scope, 'RdsDb', props);
    }

    default: {
      throw new Error(`Invalid dbOptions.engine value: ${options.engine}`);
    }
  }
};

export default createDbConstruct;
