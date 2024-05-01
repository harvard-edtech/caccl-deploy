# Refactor

Summarizing thoughts and logic behind the refactor to using TypeScript + Yargs instead of JavaScript + CommanderJS.

## TypeScript Changes

A quick outline of the changes include:
 - adding typing everywhere
    - only use `any` as a temporary solution, will bre replaced later
    - utilize `zod` for parsing verify that inputted data is the type we expect
 - Use [tsup](https://github.com/egoist/tsup) to bundle/build
 - Break up files into single function-per-file
 - Minimizing use of global variables
    - still WIP

In addition, we are adding JSDoc and generally following the style [outlined here](https://harvard-edtech.github.io/edtech-guide/).


## Yargs Changes (WIP)

Main bullet points:
 - add better typing for parsed command line arguments
 - split commands out into separate files/functions
   - separate commands into `add<command>` and `<command>Operation`
 - have a standardized way of adding the commands to the app
