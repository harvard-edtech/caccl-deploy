# caccl-deploy

This package tries to provide a simple (yet opinionated) method of deploying
CACCL apps to AWS Elastic Container Service (ECS).

### Requirements

- nodejs ≥ v10
- a nodejs/react app built using the CACCL library
- one of the following:
  - docker installed locally if you want `caccl-deploy` to build the image for you
  - an existing docker image of the app
- an AWS Certificate Manager certificate, preferably one that matches a hostname you have
  in mind for the app.
- an AWS account with create/update privileges for the following services and/or resources:
  - VPC
  - Elastic Load Balancer
  - ECS
  - IAM Role
  - Cloudwatch Log Group
  - Cloudformation

### Running as an installed package

- `npm run deploy` - executes a deployment if a `deployConfig.js` exists in the default location
  (`${PWD}/config/deployConfig.js`), otherwise will walk through creating one
- `npm run deploy config` - creates or updates the deploy configuration
- `npm run deploy diff` - shows changes that will be applied by a deploy
- `npm run deploy list` - will out put the name of the deployment stack; useful as a sanity check

### Running standalone

- `node index.js [-c path to deploy config] [cdk command]`

### `deployConfig.js`

```
module.exports = {
  // REQUIRED - the ARN of an AWS Certificate Manager certificate
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/8fd252e0-1818-423d-b65d-281fb4f1568f',

  // this will be used as part of most resource names
  appName: 'my-app',

  // -- Everything below this point is optional and/or has a default value --

  // if not provided a vpc will be created and `cidrBlock` will be required
  vpcId: 'vpc-123abc456def'

  // only needed if 'vpcId' is not provided
  cidrBlock: '10.1.100.0/24',

  //
  maxAzs: 2,

  // name of an ECS cluster; if not provided one will be created
  ecsClusterName: 'my-ecs-cluster',

  // if not provided caccl-deploy is capable of building an image asset from your app source
  appImage: 'my-org/my-app:latest',

  // the namesace prefix for AWS SecretManager entries; defaults to '/${your app name}'
  secretNamePrefix: '/caccl-deploy/my-app-staging',

  // how many concurrent tasks should the ECS service run?
  taskCount: 1,

  // how much CPU and memory should the task get? these settings are very constrained.
  // see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
  // defaults are 256 for cpu, 512 for memory
  taskCpu: 1024,
  taskMemoryLimit: 2048,

  // environment variables for the app container.
  appEnvironment: {
    CANVAS_HOST: "",
    API_KEY: "",
    API_SECRET: "",
    ACCESS_TOKEN: "",
    ICOMMONS_TOKEN: "",
    CONSUMER_KEY: "",
    CONSUMER_SECRET: "",
  },

  notifications: {
    // where to send email alerts
    email: ['me@example.edu'],
    // slack webhook notification url
    slack: 'https://hooks.slack.com/services/abc/123/xyz',
  },

  // does the app stack need a DocumentDB instance?
  docDb: false,

  // docdb sizing options; these are the default if `docDb` is true
  docDbInstanceType: 'r5.xlarge',
  docDbInstanceCount: 1,

	// default is to get this from an sts get-caller-identity call. user can override by setting AWS_ACCOUNT_ID.
	awsAccountId: '123456789012',

	// if not set default is 'us-east-1'. override with AWS_REGION.
	awsRegion: 'us-east-1',

	// taggable resources will recieve these tags in addition to any standard Cloudformation tags
	tags: {
		my-tag: 'foo',
	},
}
```

##### Required

- certificateArn

##### Optional
