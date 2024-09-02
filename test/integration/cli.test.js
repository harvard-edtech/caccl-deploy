const AWS = require('aws-sdk-mock');
const { table } = require('table');

const { setupCLI } = require('../../index');
const { conf, setConfigDefaults } = require('../../lib/conf');

describe('caccl-deploy CLI', () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Throws error dependent on error code, so we can test for it
    jest.spyOn(process, 'exit').mockImplementation((errorCode) => {
      throw new Error(
        `Process exited: ${errorCode === 1 ? 'error' : 'success'}`,
      );
    });
  });

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
    setConfigDefaults();
    const cli = await setupCLI(conf);

    // Act
    try {
      await cli.parseAsync(['node', 'caccl-deploy', 'apps']);
    } catch (err) {
      expect(err.message).toBe('Process exited: success');
    }

    expect(console.log).toHaveBeenLastCalledWith(
      table([['App'], ['test-app-1'], ['test-app-3']]),
    );
  });
});
