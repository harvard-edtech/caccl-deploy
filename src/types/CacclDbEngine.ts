import { z } from 'zod';

/**
 * Database engine options.
 * @author Benedikt Arnarsson
 */
const CacclDbEngine = z.enum(['docdb', 'mysql']);

/**
 * Available DB engines for caccl-deploy applications.
 * @author Benedikt Arnarsson
 */
type CacclDbEngine = z.infer<typeof CacclDbEngine>;

export default CacclDbEngine;
