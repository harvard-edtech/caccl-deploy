// Import oclif test
import { runCommand } from '@oclif/test';

// Import AWS SDK mock
import AWSMock from 'aws-sdk-mock';

// Import chai
import { expect } from 'chai';

// Import table
import { table } from 'table';

describe('repos', () => {
  it('lists all repos', async () => {
    // Arrange
    // @ts-ignore
    AWSMock.mock('ECR', 'describeRepositories', {
      repositories: [
        {
          repositoryName: 'test-1',
          repositoryArn: 'fake-arn',
        },
        {
          repositoryName: 'test-2',
          repositoryArn: 'fake-arn',
        },
        {
          repositoryName: 'test-3',
          repositoryArn: 'fake-arn',
        },
      ],
    });
    // @ts-ignore
    AWSMock.mock('ECR', 'listTagsForResource', {
      tags: [
        {
          Key: 'product',
          Value: 'edtech-apps',
        },
      ],
    });

    // Act
    const { stdout, error, stderr } = await runCommand('repos');

    //Assert
    // No errors
    expect(stderr).to.equal('');
    if (!!error) {
      // Process exited with 0
      expect(error.message).to.equal('EEXIT: 0');
    }
    expect(stdout).to.contain(
      table([['Repository Name'], ['test-1'], ['test-2'], ['test-3']]),
    );
  });
});
