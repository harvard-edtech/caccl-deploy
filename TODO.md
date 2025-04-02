# TODO:

- fix eslint
- package using oclif
  - reference the `../.github/workflows`
- JSDoc

- use more of built-in oclif for error handling
- add examples for commands
- tests
- JSDoc

# Fixing flow

 - AssumedRole stuff
  - ecrAccessRoleArn
 - how config is pulled in
  - make it similar to oc-ecs
 - update tests to be like oc-ecs as well
 - AWS SDK v3?
  - this will help remove the `initProfile` stuff as well,
  can just accept the profile, and no need to get the creds
  since we can just pass the profile into the Client constructors