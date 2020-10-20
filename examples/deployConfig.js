module.exports = {
  // your 11-digit AWS account id
  awsAccountId: '12345678901',
  // aws region to deploy into
  awsRegion: 'us-east-1',
  // the value of your aws access key id
  awsAccessKeyId: 'MYACCESSKEYID',
  // the value of your aws secret access key
  awsSecretAccessKey: 'MYSECRETACCESSKEY1234567890',
  // CIDR block of the vpc to be created
  cidrBlock: '10.2.1.0/24',
  // the id of an existing vpc
  vpcId: 'vpc-1234567890',
  // the arn of an AWS certificate manager ssl cert
  certificateArn: 'arn:aws:acm:us-east-1:1234567890:certificate/cert-uuid-value',
  // name of the app
  appName: 'name-of-app',
  appImage: {
    /**
     * here you tell caccl-deploy where your app container's image comes from.
     * if you only set `repoName` it will assume a hub.docker image, e.g. 'myorg/my-app-image:latest'.
     * if you also set `repoType` to 'ecr' it will look for the image in an AWS ECR repository
     * if instead you set `buildPath` it will try to build the image and push it to a new ECR repo
     * if nothing is set it will try a docker build in the location pointed to by the $APP_DIR env var
     */
    repoName: 'myorg/my-app-image:latest',
  },
  // environment variables to be injected into the app's container
  // including LTI variables like CLIENT_ID, CONSUMER_KEY, etc.
  appEnvironment: {
    FOO: 'bar',
  },
  appSecrets: {
    MY_SECRET: 'arn:aws:secretsmanager:us-east-1:12345678901:secret:my-secret-hi9K4n',
  },
  // uncomment to add a DocumentDb cluster
  // docDb: true,
  // docDbInstances: 1,
  // docDbInstanceType: 'r5.large',
};
