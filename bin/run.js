#!/usr/bin/env node

import { execute } from '@oclif/core';
import process from 'process';

process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

await execute({ dir: import.meta.url });
