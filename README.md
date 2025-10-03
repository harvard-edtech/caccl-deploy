# caccl-deploy

This package provides a CLI and an [aws-cdk](https://aws.amazon.com/cdk/) library of constructs for deploying apps to AWS Elastic Container Service (ECS). It was created for Nodejs/React [CACCL](https://github.com/harvard-edtech/caccl) apps but will someday hopefully work for any webapp that can run via a Docker image and sit behind an nginx proxy and AWS Application Load Balancer.

### Requirements

* nodejs ≥ v12
* a docker image that runs your app on port 8080
* the [awscli tool](https://aws.amazon.com/cli/) installed and configured
* an AWS Certificate Manager certificate. You probably want one that matches the hostname you have in mind for the app.
* an AWS account with create/update/delete privileges for the relevant services. There is an example IAM policy document provided at [examples/iam-policy.json](https://github.com/harvard-edtech/caccl-deploy/examples/iam-policy.json).

***

### How does it work? / What does it do?

`caccl-deploy` lets you to do two main things:

* create and manage the deployment configuration for containerized web apps
* provision, deploy and release updates to those apps on ECS/Fargate

An "app" is assumed to be an application that has been packaged as a Docker image. Currently both Nodejs/React and Django apps are supported. Once deployed, the AWS resources dedicated to the app will consist of:

* an Application Load Balancer
* an ECS Fargate Service
* an ECS Fargate Task with (in most cases) two containers:
  * an nginx reverse proxy (provided by [hdce/dce-ecs-nginx-proxy](https://github.com/harvard-edtech/dce-ecs-nginx-proxy))
  * the app itself.
* a CloudWatch dashboard containing widgets for monitoring metrics and alarms
* an SNS topic capable of sending notifications via email or Slack
* (optionally) either a DocumentDb or Mysql database cluster accessible to the app

As part of this app deployment, `caccl-deploy` will create and manage a deployment configuration. This configuration will be stored in a combination of SSM Parameter Store entries and SecretsManager entries. The configuration consists of:

* the name of the CloudFormation stack containing your underlying infrastructure (VPC, ECS Cluster)
* the ARN of an ACM ssl certificate
* one of either
  * the ARN of a Docker image in an ECR repository
  * the name of an image in, e.g., DockerHub
* An optional set of environment variables your app needs
* An optional set of AWS resource tags
* various task provisioning settings, such as number of CPUs, memory, number of tasks, etc
* database cluster options, such as engine type (mysql or docdb), instance type, number of instances
* an optional set of scheduled tasks to be executed via CloudWatch Events and a Lambda function.

***

### Install & Getting Started

For the typical use case `caccl-deploy` should be installed globally.

`npm install -g caccl-deploy`

If you are developing `caccl-deploy` you'll want to `git clone` the repo and do:

`npm install && npm link`

##### awscli

If you have not already, make sure to install [awscli](https://aws.amazon.com/cli/) and run `aws configure` to configure your AWS credentials. Otherwise `caccl-deploy` will complain and refuse to run.

***

### Quick command summary

These are all executed via the `caccl-deploy` cli. For example, `caccl-deploy new`. Execute `caccl-deploy` with no options or with the `-h|--help` flag to show the list of subcommands. Use the `-h|--help` flag on any of the subcommands to show the options available.

`new` - create a new app configuration via import or CLI prompts or a combination of both

`apps` - list existing app configurations

`delete` - remove an app configuration

`show` - output an app's configuration data

`update` - modify or delete a single setting in an app's configuration

`repos` - list your available ECR repositories

`images` - list the available images in an ECR repository

`stack` - do stuff with the app's CDK-based CloudFormation stack

`restart` - restart an app's Fargate service

`exec` - run a one-off fargate task using app's docker image (e.g. a django `migrate`)

`schedule` - add a scheduled execution of your app with an overridden container command, for instance, running django's `clearsessions` task on a regular basis

***

### Configuring `caccl-deploy`

The `caccl-deploy` cli has it's own configuration file for providing default values to options common to many of the subcommands. The location of the file is dependent on your system. For instance, on Linux, mine is at `~/.config/caccl-deploy-nodejs/config.json`.

The first time you run `caccl-deploy` (or if its config file is not present) there is an initialization sequence that will create the file with a couple of necessary settings and prompt you to confirm.

```
   ____               _       ____             _             _
  / ___|__ _  ___ ___| |     |  _ \  ___ _ __ | | ___  _   _| |
 | |   / _` |/ __/ __| |_____| | | |/ _ \ '_ \| |/ _ \| | | | |
 | |__| (_| | (_| (__| |_____| |_| |  __/ |_) | | (_) | |_| |_|
  \____\__,_|\___\___|_|     |____/ \___| .__/|_|\___/ \__, (_)
                                        |_|            |___/
It looks like this is your first time running caccl-deploy.
A preferences file has been created at ~/.config/caccl-deploy-nodejs/config.json
with the following default values:

  - ssmRootPrefix: "/caccl-deploy"
  - cfnStackPrefix: "CacclDeploy-"
  - productionAccounts: []

Please see the docs for explanations of these settings
✖ Continue … yes
```

There are four possible settings in the `config.json`:

* `ssmRootPrefix` (string) - this determines the root namespace for all SSM Parameter Store entries controlled by `caccl-deploy`. For instance, the default value of `/caccl-deploy` means that the program will only look for parameters whose names begin with that string, and newly created app configurations will be created with a namespace of `/caccl-deploy/my-new-app`. See the section below on Parameters & Secrets for more detail.
* `cfnStackPrefix` (string) - this determines the prefix for all CloudFormation stacks controlled by `caccl-deploy`. For example, if you create an app called "foo-app" it will be provisioned with the CFn stack "CacclDeploy-foo-app".
* `ecrAccessRoleArn` (string, optional) - the ARN of an IAM role for allowing cross-account access to ECR repositories and images. This setting is necessary for situations in which you have multiple AWS accounts but only use ECR repos/images in one of them. See the section below on ECR Repositories.
* `productionAccouts` (array, optional) - if you want an additional, loud warning prompt when performing operations on a production account, include its account id (as a string) here.

Example:

```
{
    "ssmRootPrefix": "/caccl-deploy",
    "cfnStackPrefix": "CacclDeploy-",
    "ecrAccessRoleArn": "arn:aws:iam::121212121212:role/CrossAccountEcrAccess",
    "productionAccounts": ["343434343434"]
}
```

***

### Deployment configuration

The deployment configuration for an app can be represented as JSON but is stored in a flattened state in AWS Parameter Store as separate entries beneath an app namespace. For example, this snippet of a JSON-serialized configuration for an app called "my-app"...

```
{
  ...
  "notifications": {
    "email": "somebody@example.edu",
    "slack": "https://hooks.slack.com/services/abc/123/xyz"
  }
  ...
}

```

... would be stored as two Parameter Store entries:

* `/caccl-deploy/my-app/notifications/email`
* `/caccl-deploy/my-app/notifications/slack`

To view the JSON-serialized configuration you can use the `caccl-deploy show` subcommand, e.g. `caccl-deploy show --app my-app`. Add the `--flat` option to that command to view a flattend version of the JSON.

##### Complete configuration example

```
{
  // These are required
  "infraStackName": "my-infra-stack",
  "appImage": "arn:aws:ecr:us-east-1:123456789012:repository/hdce/my-app-image:1.0.0",
  "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/172b09cc-84a8-4d9d-a463-c1fc0f19a3fd",

  // See "Security" section below
  "firewallSgId": "sg-12345abcdef"

  // Everything else is optional or has defaults
  "appEnvironment": {
    "FOO": "barbar",
    "WOOF": "12345",
    "BAZ": "blarg"
  },
  "notifications": {
    "slack": "https://hooks.slack.com/services/abc/123/xyz",
    "email": "somebody@example.edu",
  },
  "tags": {
    "AppName": "my-app",
    "DeployedUsing": "caccl-deploy"
  },
  "taskCount": "1",
  "taskCpu": "256",
  "taskMemory": "512",
  "gitRepoVolume": {
    "appContainerPath": "/app/volume",
    "repoUrlSecretArn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:/caccl-deploy/my-app/git-repo-url"
  },
  "dbOptions": {
    "engine": "mysql",
    "instanceCount": 1,
    "instanceType": "t3.medium",
  },
  "cacheOptions": {
    "engine": "redis",
    "numCacheNodes": 1,
    "cacheNodeType": "cache.t3.medium"
  },
  "scheduledTasks": {
    "my-task-id": {
      "schedule": "0 4 * * ? *",
      "command": "python manage.py some_task",
      "description": "run some_task every day at 4AM GMT"
    }
  }
}
```

The following DocumentDb configuration was used by caccl-deploy prior to version 0.7.0 and is still supported (but should not be used in new deployments).

```
{
  "docDb": "true",
  "docDbInstanceCount": "1",
  "docDbInstanceType": "t3.medium",
  "docDbProfiler": "true"
}

```

##### Config setting explanations

First the required values.

`infraStackName` (string) - this tells `caccl-deploy` what set of shared infrastructure resources your app will be deployed into. For this setting you just want the string value of the CloudFormation stack name. The companion project, [dce-ecs-infra](https://github.com/harvard-edtech/dce-ecs-infra) is what we use to build out that infrastructure.

`appImage` (string) - this tells `caccl-deploy` where to find your app's Docker image. This value should be the ARN of an ECR repo plus an image tag.

`certificateArn` (string) - one of the components of the app provisioning that `caccl-deploy` creates is a Application Load Balancer. You will need to create (or import) an ACM certificate so that it can be attached to the load balancer. This value should be the full ARN of that certfiicate.

Now the optional stuff.

`firewallSgId` (string) - set this to import/re-use an existing security group that will be applied to the load balancer and bastion host. See "Security" below.

`appEnvironment` ({ \[string]: string }) - a set of key value pairs that will be injected into your app's runtime container environment. You'll probably have some of these. Note that the actual values of these are always stored as SecretsManager entries, and your ECS Fargate Task Definition will be created with the ARN values of those secrets. `caccl-deploy` manages the registering/resolving for you, so when you run `caccl-deploy show --app my-app` the output will contain the raw, dereferenced strings. You can add the `--keep-secret-arns` flag to see the actual ARN values.

`notifications.slack` (string) - a slack webhook URL. If configured this will result in a Lambda function being added to your stack and subscribed to the stack's SNS topic for alert notifications.

`notifications.email` (\[string])- an email address for subscribing to the stack's SNS topic for alerts and other notifications. This setting also supports a list of addresses, which would be represented as `notifications.email.[0-n]`. In other words, the following configuration is also supported:

```
{
  "notifications": {
    "email": [
      "foo@example.com",
      "bar@example.com"
    ]
  }
}
```

***Important***: The configured address(es) will receive a confirmation message and must confirm to complete the subscription.

`tags` ({ \[string]: string }) - a set of key value pairs. these will be assigned to the CloudFormation stack and by extension all the resources in the stack (for resource types that support this (which is most)).

`taskCount` (number) - how many concurrent tasks should the Fargate service run. Default is "1".

`taskCpu` (number) - the amount of CPU units assigned to each task. Default is "256", which is equivalent to 1 virtual CPU (vCPU). See note below.

`taskMemory` (number) - memory in MB assigned to each task. Default is "512". See note below.

`targetDeregistrationDelay` (number) - number of seconds between when the load balancer stops sending requests to a target (i.e. an app task instance) and when it actually deregisters the target. See [Deregistration Delay](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay).

`gitRepoVolume` (string) - You can ignore this unless you have the very edge case situation in which your app needs a private git repo to be checked out to an attached volume. In which case set the mount path with `appContainerPath` and the `repoUrlSecretArn` with the ARN of a SecretsManager entry containing the full url of the github repo, including username and password.

**Database & cache options**

`dbOptions.engine` (string) - Allowed values are "mysql" and "docdb". If set, a cluster of the specified type will be provisioned and its connection details and credentials injected into the container environment. See the Database section below for more info.

`cacheOptions.engine` (string) - "redis" is the only supported value. If set, an Elasticache instance will be provisioned and its connection details injected into the container environment. See the Cache section below for more info.

##### A note about `taskCpu` and `taskMemory`

These values are closely related, and setting one affects the set of valid choices for the other. See the [ECS docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size) for the constraints on these values.

For dev/staging apps the defaults are almost always going to be fine. An exception might be if you're trying to load test something, in which case it's going to depend on what you're trying to test. As a general rule it's typical to have a 1:2 ratio of cpu:memory. For instance, a production app might have "2048" for `taskCpu` and "4096" for `taskMemory`.

***

### Parameters & appEnvironment Secrets

`caccl-deploy` stores app deployment configurations in AWS Parameter Store as a set of individual parameters using a namespace hierarchy. This is fairly common approach and has been [written](https://medium.com/nordcloud-engineering/ssm-parameter-store-for-keeping-secrets-in-a-structured-way-53a25d48166a) up in [various](https://aws.amazon.com/blogs/mt/organize-parameters-by-hierarchy-tags-or-amazon-cloudwatch-events-with-amazon-ec2-systems-manager-parameter-store/) places.

The exception is values that are part of your `appEnvironment` settings. For each variable defined in `appEnvironment`, `caccl-deploy` creates a corresponding SecretsManager entry and then stores the ARN of the secret as the value of the Parameter store entry. Yes, this is a bit convoluted, but the creation, updating and deletion of these settings should be handled seamlessly by the program.

***

### ECR Repositories

Some of `caccl-deploy`'s functionality assumes the existence of ECR repositories. For instance, the `repos` subcommand will output a list of available repositories, and the `images` subcommand will provide a list of images/tags within a given repository.

DCE uses [dce-ecr-action](https://github.com/harvard-edtech/dce-ecr-action) to create and push images to ECR respositories using Github Actions.

##### Cross account ECR access setup

In situations where you have multiple AWS accounts (e.g. "production" vs "development") but keep all your ECR repos in one of them, cross-account access is necessary for two reasons:

1. when Fargate tasks execute in the production account they need to be able to pull images from the development account's ECR repositories
2. `caccl-deploy` provides a `--profile` option for working with multiple AWS accounts. Some subcommand processes need to access and manipulate resources in the production account, but also access the ECR repositories in the development account. Rather than juggling multiple aws-sdk API clients, one for each account, the `caccl-deploy` code can create a single client connection and use a cross-account access IAM role when necessary.

There are two parts to setting this up. For the purposes of this README lets assume you have a "production" account and a "development" account, and your ECR repos are managed in the "development" account.

1. To allow image pulling from production tasks all ECR repos need to have the following in their permission policies:

```
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Sid": "AllowPushPull",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::[production account id]:root"
      },
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ]
    }
  ]
}
```

2. For `caccl-deploy` to work with multiple accounts there needs to be an IAM role that it can assume in the account containing the ECR repos. This role needs to have ECR permissions (the AmazonEC2ContainerRegistryPowerUser managed policy is good), and in its Trust Relationship settings you'll need this policy document:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::[production account id]:root"
        ]
      },
      "Action": "sts:AssumeRole",
    }
  ]
}
```

Once this role is created its ARN should be added to your `caccl-deploy` configuration file. See "Configuring caccl-deploy" above. Note that the AWS logins of caccl-deploy users must have the "sts:AssumeRole" permission for this role resource.

***

### Database

For apps that require a database you must set `dbOptions.engine` to either "mysql" or "docdb" in your deploy configuration. You can add to an existing configuration using the `update` command.

`caccl-deploy update -a [app name] dbOptions.engine mysql`

By default you will get a single instance of type "t3.medium". We turn slow query profiling on by default.

Including either type of database in your deploy configuration will result in a bastion host being added to the stack resources to facilitate ssh tunnelling connections to the database.

The `caccl-deploy connect ...` command can be used for creating ssh port-forwarding tunnels via the bastion host to the db instances. The tunnels are created by means of an AWS ssm session (not ssh) which doesn't depend on the bastion instances running on a public subnet with public IPs.

##### Common db options

`dbOptions.engine` (string) - either "mysql" or "docdb"

`dbOptions.instanceType` (string) - default is "t3.medium". Consider at least "r5.large" for production.

`dbOptions.instanceCount` (number) - Default is "1". Production apps should use "2" to enable multi-az replication.

`dbOptions.engineVersion` (string) - use a specific version of the docdb or aurora/mysql engine. You probably don't need to set this.

`dbOptions.removalPolicy` (string) - **IMPORTANT** can be one of "RETAIN", "SNAPSHOT" or "DELETE". See the section just below on what this does.

##### DocumentDb only

`dbOptions.profiler` ("true|false") - Enable the DocDB cluster's slow query profiling option. The default threshold for what's considered a slow query is 500ms.

##### Mysql only

`dbOptions.databaseName` (string) - Set this if you want a database to be automatically created during provisioning.

##### DocumentDb environment variables

If your deployment includes a DocumentDb cluster, the following environment variables will be injected into the app container's runtime:

* MONGO\_HOST - this is the full connection endpoint, including hostname and port
* MONGO\_USER - this will always be 'root'
* MONGO\_OPTIONS - somea necessary tls parameters
* MONGO\_PASS - value stored in secrets manager; the fargate task definition only gets the secret's ARN

##### Mysql environment variables

Likewise, if you're deploying a Mysql cluster, your container environment will get the following variables:

* DATABASE\_HOST - the full connection endpoint, including hostname and port
* DATABASE\_USER - this will always be 'root'
* DATABASE\_PASSWORD - value stored in secrets manager; the fargate task definition only gets the secret's ARN
* DATABASE\_NAME - whatever you set `dbOptions.databaseName` to, otherwise an empty string

##### IMPORTANT: Database removal policies

A removal policy tells cloudformation what you want it to do when it removes your resource, whether through a deletion or replacement. There are three options: **RETAIN**, **SNAPSHOT** and **DESTROY**.

* **DESTROY** - this one is pretty obvious. essentially it means you don't care, just delete the thing. This is the caccl-deploy default for both DocumentDb and Mysql database clusters, with one exception.
* **SNAPSHOT** - delete the db but first take a snapshot.
* **RETAIN** - don't delete the database. it will still be removed from the cloudformation stack, but will keep it's existing data, name, configuration, etc. This is the default **IF** your aws account is configured in the `productionAccouts` in your `config.json` (see the configuration section above). A setting of "RETAIN" will also, automatically enable deletion protection for your db cluster.

You can explicitly set any app's database resources to "RETAIN" (or "SNAPSHOT") by including it in the `dbOptions` deployment config block, like so:

```
    ...
    "dbOptions": {
      "engine": "mysql",
      "removalPolicy": "RETAIN"
    }
    ...
```

Keep in mind the "RETAIN" setting will leave orphaned db clusters/instances, parameter groups, and the db's secruity group around if overused. Also, with the "SNAPSHOT" setting, caccl-deploy doesn't have a mechanism for restoring a db into an existing or new app stack.

**Recommendation**: use the defaults, assuming your `productionAccounts` is set correctly. This will mean "DESTROY" for any app databases in the test account, and "RETAIN" for any in a production account. Consider setting it to "RETAIN" (or maybe "SNAPSHOT") for a staging app where the data in the db has some value or is difficult to reproduce.

**Note about CDK/CloudFormation**: CloudFormation resources have both a `DeletionPolicy` and `UpdateReplacePolicy` setting. The CDK combines these into `removalPolicy`. For caccl-deploy purposes, the setting will determine what happens to the resources when they are removed from the stack, whether as a result of a stack `destroy` or an update/replace operation.

***

### Cache

If your app needs an instance of Elasticache (redis flavor) you must set `cacheOptions.engine` to "redis". You can add to an existing configuration using the `update` command.

`caccl-deploy update -a [app name] cacheOptions.engine redis`

By default you will get a single cache node instance of type "cache.t3.medium".

Including a cache in your deploy configuration will result in a bastion host being added to the stack resources to facilitate port-forwarding tunnel connections to the cache instance.

##### Cache options

`cacheOptions.engine` (string) - currently the only choice is "redis"

`cacheOptions.numCacheNodes` (number) - Default is "1". Production apps should use "2" to enable multi-az replication.

`cacheOptions.cacheNodeType` (string) - Default is "cache.t3.medium". Consider "cache.r5.large" for production.

***

### Security

Some notes about app and resource security state.

* by default caccl-deploy apps are open to the internet on ports 80 and 443
* by default the bastion host, if the app has one, is open to the internet on port 22
* all databases and/or Elasticache (redis) instances run on private subnets. They should be accessible through their respective ports only to traffic coming from internal (10.1.x.x) ips.
* to access a database or cache instance from outside the vpc you must tunnel through the bastion host using an AWS ssm port-forwarding session. The `connect` command helps facilitate this.

##### Importing a security group

Should you wish to apply restrictions on where your app can be accessed from (e.g. office network or vpn), you can import an existing security group using the deployment configuration setting, `firewallSgId`. This security group will be used in place of the default for both the application load balancer and the bastion host. The security group will need to have ingress rules for at least ports 80, 443 and 22. Note that the imported security group does not become a member of the stack's resources; it continues to exist separately from the importing app's cloudformation stack and won't be updated or deleted by the app's stack update operations.

If an app imports a security group using the `firewallSgId` setting, and additional, empty security group will also be created and attached to the load balancer. This "miscellaneous" security group should be used for one-off ingress rules specific to the app. For instance, allowing an Opencast cluster admin node to push metadata updates to an instance of Porta.

Use the `caccl-deploy stack --app [app name] info` command to find the ids of security groups being used. The miscellaneous security group id will be named `CacclDeploy-[app name]-misc`.

***

### Example scenarios

##### Create a new app from scratch

1. Run `caccly-deploy new`. You will be prompted for the following values. **Note**: all except the app name can be changed prior to the actual deployment:
   * The name of your app. This should be unique for the AWS account.
   * The base infrastructure stack into which your app will be deployed. If there's only one available it will be selected for you.
   * The full ARN identifier of your AWS Certificate Manager entry.
   * The ECR repository where your app's images are registered
   * The ECR image tag to use. If you don't see the one you want, just pick one; you can change it later.
   * Any AWS resource tags to apply to your app's CloudFormation stack
   * Any environment variables that should be injected into the container's runtime environment.
2. Optionally, run `caccl-deploy update --app [your app name] [setting] [value]` to add or update the generated deployment configuration.
3. Optionally, run `caccl-deploy stack --app [your app name] diff` to sanity check and see the list of resources that will be created by the CDK/CloudFormation process.
4. Run `caccl-deploy stack --app [your app name] deploy` to deploy the app. After a few minutes your app should be available and running.
5. The output from the previous command should include the hostname of your app's load balancer. Head over to Route53 and create a alias record that points your (sub)domain to the load balancer.

##### Create a new app by "cloning" the configuration for an existing app

Let's say you had an existing app called "fooapp-stage" and you wanted to create a new development instance called "fooapp-dev" with the only difference being the name of the app (i.e. the container image and all the environment variables would be the same).

1. Run `caccl-deploy show --app fooapp-stage > fooapp-dev.json` to export the existing app's config to a file.
2. Run `caccl-deploy new --app fooapp-dev -i $(pwd)/fooapp-dev.json` to import the configuration for the new app.
3. Proceed with steps 2-x from the previous scenario.

##### Update an environment variable for an existing app

Let's say your app had a couple of environment variables that needed to be changed, `API_KEY` and `API_SECRET`.

1. Run `caccl-deploy show --app [your app name]` to review your app's current configuration and environment variables.
   * Remember that, by default, `caccl-deploy` will dereference and display the raw string values of your environment variables. To see the ARNs of the SecretsManager entries you can add the `--keep-secret-arns` flag to the above command.
2. Update the `API_KEY` variable to the app environment: `caccl-deploy update --app [your app name] appEnvironment/API_KEY my-api-key`
3. Update the `API_SECRET` variable to the app environment: `caccl-deploy update --app [your app name] appEnvironment/API_SECRET 12345abcdef`
4. Run `caccl-deploy restart --app [your app name]`

Note that the final step is only a `restart` vs a `stack ... deploy`. This is because we're only changing the values of *existing* environment variables, i.e., we're not adding anything *new* to the app's CloudFormation stack. If you were adding a new environment variable you would need to run a `stack ... deploy` command as shown in the next scenario.

##### Add a new environment variable to an existing app

In this example we're going to add a new variable, `API_BASE_URL`, to an existing configuration.

1. Run `caccl-deploy show --app [your app name]` to review your app's current configuration and environment variables.
   * Remember that, by default, `caccl-deploy` will dereference and display the raw string values of your environment variables. To see the ARNs of the SecretsManager entries you can add the `--keep-secret-arns` flag to the above command.
2. Add the `API_BASE_URL` value to the app environment: `caccl-deploy update --app [your app name] appEnvironment/API_BASE_URL https://api.example.edu/v1`
3. Review the app's stack changes `caccl-deploy stack --app [your app name] diff`
4. Deploy the app's stack changes `caccl-deploy stack --app [your app name] deploy`. ***WARNING*** this will restart the app.

Note that you do not need a separate `restart` action in this case. The `stack ... deploy` action will do that for you as a result of the changes to the Fargate Task Definition.

***

### Subommands & Options Details

```
Usage: caccl-deploy [options] [command]

A cli tool for managing ECS/Fargate app deployments

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  apps [options]     list available app configurations
  new [options]      create a new app configuration
  delete [options]   delete an app configuration
  show [options]     display an app's current configuration
  update [options]   update (or delete) a single deploy config setting
  repos [options]    list the available ECR repositories
  images [options]   list the most recent available ECR images for an app
  stack [options]    diff, deploy, or delete the app's AWS resources
  restart [options]  no changes; just force a restart
  exec [options]     execute a one-off task using the app image
  connect [options]  connect to an app's peripheral services (db, redis, etc)
  schedule [options] create a scheduled task using the app image
  help [command]     display help for command
```

#### Common Options

`-V`/`--version`: This will output a generated string with the installed package version. In development context (i.e., if running from a git checkout) the version string will also include the current commit hash and branch name.

`-h`/`--help`: show usage info for the program or any subcommand

`-y`/`--yes`: for any option that would normally prompt for confirmation, including production account failsafe confirmations, adding this option will assume "yes" for all prompts. Should really be used carefully and perhaps only in some kind of scripted operation context. For subcommands that don't actually modify resources this flag does nothing.

`--profile`: this controls which set of credentials will be used for interactions with AWS. `caccl-deploy` does not manage these credentials for you; it is assumed you have the `awscli` program installed and configured.

`--ssm-root-prefix`, `--cfn-stack-prefix`, `--ecr-access-role-arn`: these are command-line args that correspond to the settings described in "Configuring caccl-deploy" above.

#### Subcommands

#### apps

This will list the existing app configurations found using the provided or configured SSM parameter name prefix.

* `--full-status` - enables the output of additional information. If the app configuration has a corresponding CloudFormation stack (i.e., it's been deployed) then 3 additional columns will be generated:
  * "Infra Stack": shows the name of the shared infrastructure stack the app is or will be deployed to
  * "Stack Status": shows the current status of the Cloudformation stack, e.g. "UPDATE\_COMPLETE".
  * "Config Drift": a "yes" value means that the app's current deployment configuration is not in sync with the Cloudformation deployment.

***

#### new

This command allows you to create a new app configuration in a few ways:

* from scratch with prompts for the required options
* import from a json file using the `-i` option, with prompts for any missing, required values

The required options (also described above in the section on "Config setting explanations") which will need to be provided via prompt or included in your imported json, are:

* `infraStackName` - this is the name of the CloudFormation stack that holds the shared infrastructure (VPC, ECS cluster). If not provided, the process will allow you to select from a list of available infrastructure stacks in the AWS account being used.

* `certificateARN` - the full ARN of an ACM certificate entry. This certificate will be used for the load balancer's HTTPS listener.

* `appImage` - the id of your app's Docker image.

The process will also prompt you to add any desired AWS resource tags and app environment variables.

When finished the process stores the deployment configuration settings in Parameter Store (and SecretsManager for any app environment variable values) using a namespace formed from your `ssmRootPrefix` and the app name.

##### options

* `-a`/`--app` - the name of the app. You will be prompted for this value if not provided. This should be unique for the AWS account being used. Otherwise you will be prompted to first wipe any existing configuration for the specified app name.
* `-i`/`--import` - use this option to import existing configuration settings (in json form) from a file.

***

#### show

Display the current deployment configuration for an app. The process fetches the relevant Parameter Store entries based on the `/[ssmRootPrefx]/[app name]` namespace and assembles them into a json object and outputs to stdout.

##### options

* `-a`/`--app` (required) - the name of the app
* `-f`/`--flat` - show the flattened version of the configuration data.
* `--keep-secret-arns` - by default the output will include the actual, dereferenced values of app environment variables stored in SecretsManager. Use this option to see the ARNs of the SecretsManger entries instead.

***

#### delete

Remove an app configuration entirely. This wipes out all Parameter Store entries for a app, including any referenced SecretsManager entries.

##### options

* `-a`/`--app` (required) - the name of the app

***

#### update

This subcommands allows adding, updating or deleting a single configuration setting.

For adding or updating use the form `caccl-deploy update -a [app name] [param] [value]`.

To delete a setting use the `-D` flag, like `caccl-deploy update -a [app name] -D [param]`.

For nested values, like an app environment variable, use the full path to the setting. For instance, to update the value of the `FOOBAR` environment variable you would use `caccl-deploy update -a [app name] appEnvironment/FOOBAR baz`.

##### options

* `-a`/`--app` (required) - the name of the app

***

#### repos

Displays a list of the available ECR repositories. See details above about cross-account ECR stuff.

***

#### images

Given a respository, this command lists its avaialble images. Use this command to get the value for your configuration's `appImage` setting.

##### options

* `-r`/`--repository` - the name of the ECR repository. Use the `repos` command to get the available list.
* `-A`/`--all` - By default the `images` command will only show those images that have been tagged with a semver-looking value, e.g. "1.0.0". Use this option to display all the available images, including those identified only by their git commit sha.

***

*The commands below all perform operations on the actual deployed resources*

***

#### stack

This subcommand acts as a wrapper for the `cdk` program (part of the [aws-cdk](https://aws.amazon.com/cdk/) library), which it spawns as a subprocess after setting up several variables in the process execution environment. Any valild `cdk` subcommand can be used, the default being `cdk list`. The most common operations will be `list`, `diff`, `deploy`, and `destroy`.

* `list` - just prints out the name of the cfn stack; useful for sanity checking
* `diff` - show what would be added, deleted or modified during a deploy
* `deploy` - execute the stack update
* `changeset` - like `deploy` but creates a CloudFormation changeset that must be manually approved via the aws cli or web console
* `destroy` - delete everything; you must first disable deletion protection for the stack via the aws cli or web console
* `info` - prints out the cloudformation stack's exported values
* `dump` - debugging; dumps the deployment config plus other bits of data used to build the stack

##### options

* `-a`/`--app` (required) - the name of the app

***

#### restart

This subcommand executes a forced redeploy of your app's ECS Fargate service without changes to any of the service or task settings. You would typically use this in a development context where, for instance, you're not switching to a new image tag but the app's current image ("stage") has been updated. Another use case would be if during development you change the value of an environment variable but you want to skip doing a full `stack deploy`.

***IMPORTANT***, any changes you have made to app environment variables or the app's container images (including the nginx proxy server) will be present when the service restarts.

##### options

* `-a`/`--app` (required) - the name of the app

***

#### exec

Some app frameworks, like Django, require additional management commands to be run during or post deployment. An example would be Django's `manage.py migrate` operation, which applies any necessary SQL migrations to your app's database. ECS Fargate, being a Docker-based platform, doesn't provide the kind of typical host environment you would have when running an app on EC2, i.e., you can't simply ssh into the "machine" and run your shell commands. If your app's Docker image is built in the proper way, however, you can run arbitrary commands *in the context* of your app's container environment. Think of the container like any compiled binary program that can be run any number of concurrent times but with different *internal* commands. Sticking with the Django example, in one container you can run your `gunicorn` process, and in another you can run `python manage.py migrate`. Both containers have your apps complete environment: project code, `settings.py`, environment variables, etc. In AWS, so long as both of the containers are run within the same VPC, Fargate service, etc., they will have access to same RDS database, cache, EBS volumes, whatever.

When `caccl-deploy` creates your Fargate service, the default 'AppContainer' instance in each task is where `gunicorn` is running (or `express` in the case of a nodejs app). The `caccl-deploy exec` command allows running those other, one-off tasks using the same Docker image and copy of the Fargate task definition, with all the same env vars and secrets, but minus the nginx proxy container.

##### options

* `-a`/`--app` (required) - the name of the app
* `-c`/`--command` (required) - the command to run
* `-e`/`--env` (repeatable) - add or override container environment variables

##### example

This will run the django `migrate` operation using the `my-app` image with an extra (or overridden) environment variable `MY_EXTRA_ENV_VAR`.

```
caccl-deploy exec -a my-app -c 'python manage.py migrate' -e 'MY_EXTRA_ENV_VAR=1'
```

***

#### connect

For connecting to peripheral services, like the DocumentDb or RDS/Mysql database via the app's ec2 bastion host. The command assembles and outputs the necessary shell commands to establish an AWS ssm port-forwarding session through the bastion host.

##### options

* `-a`/`--app` (required) - the name of the app
* `-l`/`--list` - list the services available to connect to
* `-s` / `--service` - service to connect to; use `--list` to see what is available
* `--local-port` - attach tunnel to a non-default local port

##### example

You want to see what services are available to connect to, and then connect to MySQL. You already have MySQL running locally, so for this example we will bind the tunnel to the local port, 3307 (instead of the default 3306).

```
$ caccl-deploy connect -a my-app --list
Valid `--service=` options:
  mysql
  redis
$ caccl-deploy connect -a my-app -s mysql --local-port 3307 
```

Output:

```
# tunnel command:
aws ssm start-session --target i-1234567abcdef --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{"portNumber":["3306"],"localPortNumber":["3307"],"host":["db-cluster.cluster-cnrqypmjblyx.us-east-1.rds.amazonaws.com"]}'

# mysql client command:
mysql -uroot -pxxxxxxxxxx --port 3307 -h 127.0.0.1
```

***

#### schedule

List, create and/or delete scheduled tasks (think cron jobs) that execute your app container with an overridden command.

##### options

* `-a`/`--app` (required) - the name of the app
* `-l`/`--list` - list the existing scheduled tasks
* `-d`/`--delete` - in combination with `--task-id`, delete an existing scheduled task
* `-t` / `--task-id` - a string/shortname id for your task. Will be a randomly generated id if not specified
* `-d` / `--task-description` - describe what the task does
* `-s` / `--task-schedule` - a six-field cron expression, e.g. '0 12 \* \_ ? \_'. See [Scheedule Expressions for Rules](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html) for details.
* `-c` / `--task-command` - the override command to use when starting the container (the `CMD` value).

**Important**: the `schedule` subcommand only modifies your app's deployment configuration; you must still run a `stack ... deploy` for the resource additions/changes to be provisioned.

##### example

You want to run a django command once a day at 3am.

```
$ caccl-deploy schedule -a my-app \
    --task-id daily-foo \
    --task-description "do the foo every day" \
    --task-schedule "0 8 * * ? *"
    --task-command "python manage.py foo"
$ caccl-deploy stack -a my-app [diff|deploy]

```

Note that the cron expression will need to be in GMT, so for the schedule you'll add five hours and enter "0 8 \* \_ ? \_". Why the "?"? According to the docs:

> You can't specify the Day-of-month and Day-of-week fields in the same cron expression. If you specify a value (or a \*) in one of the fields, you must use a ? (question mark) in the other.

***

## Development

### Release process

1. Confirm all updates have been merged into `devel`
2. Update `CHANGELOG.md` with release name and date
3. Run `npm version [version tag] --no-git-tag-version`
4. Commit the last two changes with a message like "\[release tag] release prep"
5. `git push devel origin`
6. `git tag [version tag]`
7. `git push [version tag] origin`
8. `git checkout main`
9. `git merge [version tag]`
10. `git push main origin`

The final push to `main` will trigger a Github action that executes an `npm publish` for you.

### Code layout

As for the code here's an overview of what's where and what does what.

##### `index.js`

This is the main cli script that defines the `caccl-deploy` command and subcommands. It uses the [commander.js](https://github.com/tj/commander.js) library, making use of some of the provided hooks and overrides to customize how the command actions and options are implemented.

##### `./lib`

Utility functions for the cli. Most important here is `aws.js`, the collection of methods that execute the aws api calls, and `deployConfig.js` which defines the interface for manipulating an app's deploy configuration.

##### `./cdk/*`

The code in this directory is where the cdk app, stack and constructs are implemented. It's possible in theory to use this code directly via the cdk's own `cdk` command, but the expectation is that it be executed via the `caccl-deploy stack` subcommand, which sets up several important environment variables based on whichever app's deployment configuration is loaded.

##### `./cdk/cdk.json`

This file tells the cdk how to execute the cdk code.

##### `./cdk/cdk.context.json`

This file is generated by cdk and contains data about the VPC infrastructure. It ***should not*** be added to version control.

##### `./cdk/index.ts`

This is the "main" script for the cdk code. It picks up the environment variables set by the `caccl-deploy stack` subcommand wrapper, fetches the deploy configuration from Parameter Store, and runs whatever cdk subcommand is requested (list, diff, deploy, etc).

##### `./cdk/lib/*`

These are the cdk construct classes that define the AWS resources that make up each app's stack.
