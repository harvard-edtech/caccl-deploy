// Import oclif test
import { runCommand } from '@oclif/test';

// Import AWS SDK mock
import AWSMock from 'aws-sdk-mock';

// Import chai
import { expect } from 'chai';

// Import table
import { table } from 'table';

describe('apps', () => {
  it('lists all apps', async () => {
    // Arrange
    // @ts-ignore
    AWSMock.mock('SSM', 'describeParameters', {
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
    const { error, stdout, stderr } = await runCommand('apps');

    // Assert
    expect(stdout).to.contain(
      `${table([['App'], ['test-app-1'], ['test-app-3']])}\n`,
    );

    // No errors
    expect(stderr).to.equal('');
    if (!!error) {
      // Process exited with 0
      expect(error.message).to.equal('EEXIT: 0');
    }
  });
});
