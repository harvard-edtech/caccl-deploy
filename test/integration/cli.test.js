// Import AWS mock
const AWS = require('aws-sdk-mock');

// Import table
const moment = require('moment');
const { table } = require('table');

// Import CLI and conf
const { setupCLI } = require('../../index');
const { conf, setConfigDefaults } = require('../../lib/conf');

// Helpers
const runCLI = async (...args) => {
  const cli = await setupCLI(conf);

  let res;
  try {
    res = await cli.parseAsync(['node', 'caccl-deploy', ...args]);
  } catch (err) {
    return err.message;
  }

  return res;
};

// Tests
// TODO: test failure scenarios?
describe('caccl-deploy CLI', () => {
  // Setup
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Throws error dependent on error code, so we can test for it
    jest.spyOn(process, 'exit').mockImplementation((errorCode) => {
      throw new Error(
        `Process exited: ${errorCode === 1 ? 'error' : 'success'}`,
      );
    });

    // Set conf
    setConfigDefaults();
  });

  afterEach(() => {
    AWS.restore();
  });

  // apps
  // TODO: test other flags for apps
  it('lists apps with the app command', async () => {
    // Arrange
    AWS.mock('SSM', 'describeParameters', {
      Parameters: [
        {
          Name: '/caccl-deploy/test-app-1',
        },
        {
          Name: '/deploy/test-app-2',
        },
        {
          Name: '/caccl-deploy/test-app-3',
        },
      ],
    });

    // Act
    const res = await runCLI('apps');

    // Assert
    expect(res).toBe('Process exited: success');

    expect(console.log).toHaveBeenLastCalledWith(
      table([['App'], ['test-app-1'], ['test-app-3']]),
    );
  });

  // TODO: connect

  // TODO: delete

  // TODO: exec

  // images
  // TODO: more scenarios
  it('lists images with the images command', async () => {
    // Arrange
    AWS.mock('ECR', 'describeImages', {
      imageDetails: [
        {
          imagePushedAt: 1725416968,
          imageTags: ['main'],
          registryId: 'test-registry-id',
        },
        {
          imagePushedAt: 1725416068,
          imageTags: ['1.0'],
          registryId: 'test-registry-id',
        },
        {
          imagePushedAt: 1725410968,
          imageTags: ['feature/test'],
          registryId: 'test-registry-id',
        },
      ],
    });

    // Act
    const res = await runCLI('images', '-r', 'test');

    // TODO: discuss this
    // const res = await runCLI('images', '-r', 'test', '--all');

    // Assert
    expect(res).toBe('Process exited: success');

    expect(console.log).toHaveBeenLastCalledWith(
      table([
        ['Pushed On', 'Tags', 'ARNs'],
        [moment(1725416968).format(), '', ''],
      ]),
    );
  });

  // TODO: new

  // TODO: release

  // repos
  // TODO: more scenarios
  it('lists repos with the repos command', async () => {
    // Arrange
    AWS.mock('ECR', 'describeRepositories', {
      repositories: [
        {
          repositoryName: 'test-1',
          repositoryArn: '',
        },
        {
          repositoryName: 'test-2',
          repositoryArn: '',
        },
        {
          repositoryName: 'test-3',
          repositoryArn: '',
        },
      ],
    });

    // TODO: could test non-edtech-apps via (params, callback) => callback(null, { tags: ... });
    AWS.mock('ECR', 'listTagsForResource', {
      tags: [
        {
          Key: 'product',
          Value: 'edtech-apps',
        },
      ],
    });

    // Act
    const res = await runCLI('repos');

    // Assert
    expect(res).toBe('Process exited: success');

    expect(console.log).toHaveBeenLastCalledWith(
      table([['Repository Name'], ['test-1'], ['test-2'], ['test-3']]),
    );
  });

  // TODO: restart

  // TODO: schedule

  // TODO: show

  // TODO: stack - need to catch the CDK call

  // TODO: update
});
