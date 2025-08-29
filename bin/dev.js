#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

// eslint-disable-next-line n/shebang
import { execute } from '@oclif/core';

process.env.CDK_APP_CMD = '"node --loader ts-node/esm src/cdk/cdk.ts"';

await execute({ development: true, dir: import.meta.url });
