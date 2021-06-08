# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

- bug fix, require.resolve behavior change in node 12+ <https://github.com/nodejs/node/issues/27583>
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

[unreleased]: https://github.com/harvard-edtech/caccl-deploy/compare/v0.6.4...HEAD
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
