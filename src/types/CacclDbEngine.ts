// Import Zod
import { z } from 'zod';

const CacclDbEngine = z.enum(['docdb', 'mysql']);

/**
 * Available DB engines for caccl-deploy applications.
 * @author Benedikt Arnarsson
 */
type CacclDbEngine = z.infer<typeof CacclDbEngine>;

export default CacclDbEngine;
