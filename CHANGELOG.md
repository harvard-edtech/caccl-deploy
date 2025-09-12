# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- switch to an amazonlinux2023 ami for the bastion hosts

## [0.18.0] - 2025-07-14

### Modified

- reverted the packaging and github community action version updates due to 
  compatability issues with the dce-dev-wizard
- updated the method for fetching bastion instance id

### Added

- supressing some cdk warnings and notices

## [0.17.0] - 2025-06-17

### Modified

* always use the most up-to-date Amazon Linux 2 AMI
* skip version compare if CfN output value undefined
* update action versions for the npm publish workflow

## [0.16.0] - 2025-01-08

### Added

* task role now gets SES permissions to send email

### Modified

* dropped node v12 and v14 from testing matrix; added v20
* added `retryWrites=false` to doc db options

## [0.15.0] - 2024-02-05

### Fixed

* now uses the correct mysql "major" version value so that v8.0 parameter groups are possible

### Added

* new deploy config setting to enable the ECS service remote command execution feature

## [0.14.0] - 2023-07-26

### Fixed

* `ts-node` package was incorrectly listed in the dev dependencies
* pinning dep versions in a way that works with shrinkwrap + tarball installation

### Added

* `lbOptions.healthCheckPath` - specify a different path for the load balancer target health check requests

### Modified

* default mysql/aurora LTS version to use

### Removed

* ability for app stack to create its own vpc
* lookup table for ssh bastion instance ami id to use in alternate regions

## [0.13.0] - 2022-09-13

### Modified

* migrate to CDK v2 w/ associated import statement changes
* dropped support for node v10.x, added support for v18.x

### Fixed

* one-off app-only task exec now users fargate platform 1.4 (same as regular app task)

### Added

* prettier formatting
* husky + lint-staged commit hook

## [0.12.0] - 2022-03-17

### Modified

* aws-cdk, eslint, jest and object-hash dependency versions

## \[0.11.1] - 2022-03-15

### Added

* apps that use an imported security group via `firewallSgId` will also now create another, miscellaneous
  security group, attached to the load balancer. This group will initially have no ingress rules and is meant
  for things like allowing an Opencast instance to push metadata updates to Porta, and other situations that
  wouldn't be appropriate for a common security group shared with other apps

## [0.11.0] - 2022-02-22

### Modified

* updated the alarm threshold docdb cursor timeouts. Instead of firing on each occurrance it now has to see 5 over 5 minutes for 3 consectuive evaluation periods.
* update to Fargate platform version 1.4

### Fixed

* fixed two files related to task scheduling that were somehow formatted with tabs instead of spaces
* tags are now propagated from the ECS service to the Fargate tasks

### Added

* new deploy configuration setting: `targetDeregistrationDelay`, specifies number of seconds between when load balancer stops sending new reguests to a target and the target is finally deregistered.
* new configuration setting, `firewallSgId` allows for importing a security group to apply to the load balancer and bastion host. meant as a way to restrict app traffic to internal (office, vpn) ips.

## [0.10.3] - 2021-09-29

### Changed

* `stack ... changeset` now also obeys the `--yes` flag

## [0.10.2] - 2021-09-28

### Fixed

* migrate to lockfileVersion 2 so that npm v7 can symlink our dependent binaries correctly

## [0.10.1] - 2021-09-28

### Fixed

* `isProductionAccount` was erroring if user's config didn't set `productionAccounts`

## [0.10.0] - 2021-09-24

### Fixed

* rds/mysql database metrics were not showing up. Database constructs were rewritten to allow rds/mysql metrics to come from db instances while docdb metrics continue to come from the cluster
* rearranged the db section of the dashboard

### Added

* `innodb_monitor_enable='all'` added to the rds/mysql instance parameter group to provide additional metrics
* two new dashboard db metrics: Transactions and Queries

## [0.9.3] - 2021-09-23

### Fixed

* fixing an issue with the last release: performance insights isn't supported on all instance types

## [0.9.2] - 2021-09-23

### Changed

* `stack` subcommand now uses explicit path to the `cdk` executable instead of `npx`
* `cdk.json` app configuration now uses explicit path to `ts-node` executable instead of `npx`

### Added

* `stack` subcommand now sets `CDK_DISABLE_VERSION_CHECK` to supress the "newer version available" messages.
* enabled performance insights (free tier) on rds mysql db instances

## [0.9.1] - 2021-09-21

### Fixed

* "main" is now considered a primary branch name when fetching a list of available ECR images
* during the `new` command process, the error thrown when there are no valid image tags has a more informative message

## [0.9.0] - 2021-09-17

### Added

* New deployment configuration setting to control database removal policy: `dbOptions.removalPolicy`.
* databases now get their own security groups so that we can set them to the same removal policy.

## [0.8.1] - 2021-09-15

### Changed

* no longer assigning a name to the Fargate Service as it would in some cases cause name collision errors when CloudFormation needed to replace the resource. As a result the service names will be something like:
  * "CacclDeploy-foo-app-EcsServiceFargateServiceF382E1EB-pbHI10hubZdS"
  * instead of "CacclDeploy-foo-app-service"

## \[0.8.0] - 2021-09-14

### Added

* scheduled tasks: managed with new `schedule` subcommand, and executed using CloudWatch Events and a Lambda function
* new `connect` subcommand options:
  * `-q` / `--quiet` - only output the ssh tunnel command (suitable for wrapping in a shell script)
  * `-S` / `--sleep` - increase/decrease the amount of time the tunnel will stay open waiting for activity (e.g. a client connection)
* an example iam policy that should cover all needed aws permissions

### Changed

* the aws-sdk and all aws-cdk packages updated to the latest release

## [0.7.4] - 2021-08-13

### Added

* additional column in the `show ... --full-status` output showing the version of caccl-deploy used for the most recent deployment

## [0.7.3] - 2021-08-12

### Fixed

* can't rely on docdb engine version and parameter group family perfectly matching; cloudformation is **REALLY** picky about this stuff

## [0.7.2] - 2021-08-12

### Fixed

* stack vs cli version diff check was failing if stack didn't actually exist yet

## [0.7.1] - 2021-08-12

### Fixed

* version generation incorrectly detecting if programming running from a git repo

## [0.7.0] - 2021-08-11, porta deployment changes

### Fixed

* bug fix: `helpers.fromJson` couldn't handle relative paths. Replaced use of `require.resolve`
  with `path.resolve` and added a couple of tests.
* docdb engine version wasn't being pinned properly for the cluster or parameter group
* ec2 ami for bastion hosts is now pinned to prevent surprise replacements

### Added

* CDK construct for deploying an Elasticache (redis) instance
* new `exec` command for running one-off app tasks (e.g. a django `migrate`)
* new `stack` subcommand, `info`, which just prints out all the cloudformation stack exports
* new `stack` subscommand, `changeset`, like deploy but generates a CloudFormation changeset that must be manually inspected and approved
* extra confirmation if the deployed stack version differs from the cli version by more than a patch level

### Changed

* `cdk/lib/db` now supports multiple db engines: currently docdb or aurora/myql.
  **Note**: the previous deploy configuration for including a docdb instance,
  `{ docDb: true, ... }`, is still supported, but new apps should use the new
  format. See README for more info.
* nginx proxy image now pulled with `latest` tag

## [0.6.4] - 2021-06-09

### Changed

* updated the `cdk/.npmignore` file which was excluding important files from the published package!

## [0.6.3] - 2021-06-04

### Changed

* allow a successful load balancer target health check for a 302 response
* pin the fargate version to 1.3
* pin docdb engine version to 3.6.0

## [0.6.2] - 2021-05-21

### Changed

* added 2 (two!) jest tests
* `./cdk` no longer has it's own `package.json`
* switched from `package-lock.json` to `npm-shrinkwrap.json` to ensure that published
  releases install with the expected dependency versions

## [0.6.1] - 2021-02-19

### Added

* utility script, `bin/perms.sh` for examining IAM user permissions

### Changed

* update our github action npm publish workflow to run on push to main & use
  [JS-DevTools/npm-publish](https://github.com/marketplace/actions/npm-publish)
* Fix task definition registration to exclude invalid parameters
* Fix the `release` command process so that the Fargate service uses the newly
  created task definition
* rename default git branch to "main"

## [0.6.0] - 2021-02-05

### Added

* Fargate service now enables the "circuit breaker" feature

### Removed

* unecessary eslint config in the `./cdk` subtree

### Changed

* package dependencies updated

## [0.5.4]

## [0.5.3]

## [0.5.2]

## [0.5.1]

## [0.5.0]

## [0.4.1]

## [0.4.0]

## [0.3.0]

[unreleased]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.17.0...HEAD

[0.17.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.16.0...v0.17.0

[0.16.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.15.0...v0.16.0

[0.15.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.14.0...v0.15.0

[0.14.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.13.0...v0.14.0

[0.13.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.12.0...v0.13.0

[0.12.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.11.0...v0.12.0

[0.11.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.10.3...v0.11.0

[0.10.3]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.10.2...v0.10.3

[0.10.2]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.10.1...v0.10.2

[0.10.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.10.0...v0.10.1

[0.10.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.9.3...v0.10.0

[0.9.3]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.9.2...v0.9.3

[0.9.2]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.9.1...v0.9.2

[0.9.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.9.0...v0.9.1

[0.9.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.8.1...v0.9.0

[0.8.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.7.4...v0.8.1

[0.7.4]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.7.3...v0.7.4

[0.7.3]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.7.2...v0.7.3

[0.7.2]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.7.1...v0.7.2

[0.7.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.7.0...v0.7.1

[0.7.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.6.4...v0.7.0

[0.6.4]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.6.3...v0.6.4

[0.6.3]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.6.2...v0.6.3

[0.6.2]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.6.1...v0.6.2

[0.6.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.6.0...v0.6.1

[0.6.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.5.4...v0.6.0

[0.5.4]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.5.3...v0.5.4

[0.5.3]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.5.2...v0.5.3

[0.5.2]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.5.1...v0.5.2

[0.5.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.5.0...v0.5.1

[0.5.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.4.1...v0.5.0

[0.4.1]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.4.0...v0.4.1

[0.4.0]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.3.0...v0.4.0

[0.3.0]: https://github.com/harvard-edtech/caccl-deploy/releases/tag/v0.3.0
