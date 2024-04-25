# TODO

General migration:
 - **FIX ESLINT**
 - make comprehensive Jest tests on base JS
   - git worktree?
 - use same tests on TS

TS migration:
 
 - etc.
 - pull out global state to a context which is made at top level and passed everywhere

Yargs migration:

 - [ ] Update package.json (use tsup and add yargs)
    - use `tsup src/index.ts src/cli.ts`
 - [ ] move subcommands into separate files
    - - keep a library and a cli
 - [ ] re-arrange common logic and utilities
 - [ ] fix typing issues
 - [ ] add better types throughout
 - [ ] replace commander with yargs
    - helpful 'help' messages
    - organized well
    - use `.options` for typing

Misc:

 - Ask Jay about the `cdk` directory
 - Also look into migrating to v3, to trim/modularize AWS SDK


Notes:

 - DeployConfig properties:
   -  `infraStackName`: `string`
   - `certificateArn`: `string` (ARN)
   - `appImage`: `string` (ARN)
   - `tags`: `Record<string, string>`
   - `appEnvironment`: `Record<string, string>`
   - `enableExecuteCommand`: `boolean`
   - `proxyImage`: `string` (ARN)
   - `dbOptions`: `DbOptions`
      - `databaseName`: `string`
      - `engine`: `string` (docdb, mysql)
      - `instanceCount`: `string`
      - `instanceType`: `string` (EC2 instance)
      - `removalPolicy`: `string` (RETAIN or DESTROY)
   - `docDb`: deprecated!
   - `scheduledTasks`: `Record<string, TaskSettings>`
      - `TaskSettings`:
         - `command`: `string`
         - `schedule`: `string`
         - `description`: `string`
   - `taskCount`: `string`
   - `taskCpu`: `string`
   - `taskMemory`: `string`
   - `cacheOptions`: `CacheOptions`
      - `engine`: `string` (redis)