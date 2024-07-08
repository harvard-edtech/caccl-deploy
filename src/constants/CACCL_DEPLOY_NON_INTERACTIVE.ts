/**
 * Setting this env var is the equivalent of passing the `--yes` argument
 * to any subcommand. It tells caccl-deploy to not prompt for confirmations.
 * This includes production account failsafe prompts, so be careful.
 */
const { CACCL_DEPLOY_NON_INTERACTIVE = false } = process.env;

export default CACCL_DEPLOY_NON_INTERACTIVE;
