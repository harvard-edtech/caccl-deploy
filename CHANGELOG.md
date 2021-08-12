# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

## [0.7.1] - 2021-08-12

### Fixed

- version generation incorrectly detecting if programming running from a git repo

## [0.7.0] - 2021-08-11, porta deployment changes

### Fixed

- bug fix: `helpers.fromJson` couldn't handle relative paths. Replaced use of `require.resolve`
  with `path.resolve` and added a couple of tests.
- docdb engine version wasn't being pinned properly for the cluster or parameter group
- ec2 ami for bastion hosts is now pinned to prevent surprise replacements

### Added

- CDK construct for deploying an Elasticache (redis) instance
- new `exec` command for running one-off app tasks (e.g. a django `migrate`)
- new `stack` subcommand, `info`, which just prints out all the cloudformation stack exports
- new `stack` subscommand, `changeset`, like deploy but generates a CloudFormation changeset that must be manually inspected and approved
- extra confirmation if the deployed stack version differs from the cli version by more than a patch level

### Changed

- `cdk/lib/db` now supports multiple db engines: currently docdb or aurora/myql.
	**Note**: the previous deploy configuration for including a docdb instance,
	`{ docDb: true, ... }`, is still supported, but new apps should use the new
	format. See README for more info.
- nginx proxy image now pulled with `latest` tag

## [0.6.4] - 2021-06-09

### Changed

- updated the `cdk/.npmignore` file which was excluding important files from the published package!

## [0.6.3] - 2021-06-04

### Changed
- allow a successful load balancer target health check for a 302 response
- pin the fargate version to 1.3
- pin docdb engine version to 3.6.0

## [0.6.2] - 2021-05-21

### Changed

- added 2 (two!) jest tests
- `./cdk` no longer has it's own `package.json`
- switched from `package-lock.json` to `npm-shrinkwrap.json` to ensure that published
  releases install with the expected dependency versions

## [0.6.1] - 2021-02-19

### Added
- utility script, `bin/perms.sh` for examining IAM user permissions

### Changed
- update our github action npm publish workflow to run on push to main & use
  [JS-DevTools/npm-publish](https://github.com/marketplace/actions/npm-publish)
- Fix task definition registration to exclude invalid parameters
- Fix the `release` command process so that the Fargate service uses the newly
  created task definition
- rename default git branch to "main"

## [0.6.0] - 2021-02-05

### Added
- Fargate service now enables the "circuit breaker" feature

### Removed
- unecessary eslint config in the `./cdk` subtree

### Changed
- package dependencies updated

## [0.5.4]
## [0.5.3]
## [0.5.2]
## [0.5.1]
## [0.5.0]
## [0.4.1]
## [0.4.0]
## [0.3.0]

[unreleased]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.7.1...HEAD
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
