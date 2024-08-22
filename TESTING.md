# Testing

Manual testing of CLI:
 0. apps, repos, images
    - issue with `show`

May not be necessary to test stack creation. Just test that the right params are passed to CDK.
Could also potentially compare the templates that are output, using the `--synth` flag.
Should output into the `cdk/cdk.out` directory

Scenario 1:
 1. `new`, `show`, `delete`, and `update`
  

Find way to remove the `plugin` command and display in `help`

Looking into Oclif unit testing, look into [AWS SDK mocks](https://aws.amazon.com/blogs/developer/mocking-modular-aws-sdk-for-javascript-v3-in-unit-tests/)

How to run the full command while incorporating the mocking library?
Setup a flag or environment variable or config for indicating that we are running a test,
so then it uses the mock library instead.
We want to avoid running a mock server. Instead have canned responses and evaluate outputs.
Automate these tests.

Evaluate different approaches and testing libraries for next week.
Also start some manual tests (make a branch off main for the old CLI).