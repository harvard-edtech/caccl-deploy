// Import oclif test
import { runCommand } from '@oclif/test';

// Import AWS SDK mock
import AWSMock from 'aws-sdk-mock';

// Import chai
import { expect } from 'chai';

// Import moment
import moment from 'moment';

// Import table
import { table } from 'table';

describe('images', () => {
  it('lists images', async () => {
    // Arrange
    // @ts-ignore
    AWSMock.mock('ECR', 'describeImages', {
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
    const { stdout, error, stderr } = await runCommand('images -r test');

    //Assert
    expect(stdout).to.equal(
      `${table([
        ['Pushed On', 'Tags', 'ARNs'],
        [
          moment(1725416968).format(),
          'main',
          'arn:aws:ecr:us-east-1:test-registry-id:repository/test:main',
        ],
      ])}\n`,
    );

    // No errors
    expect(stderr).to.equal('');
    if (!!error) {
      // Process exited with 0
      expect(error.message).to.equal('EEXIT: 0');
    }
  });

  it('lists all images', async () => {
    // Arrange
    // @ts-ignore
    AWSMock.mock('ECR', 'describeImages', {
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
    const { stdout, error, stderr } = await runCommand('images -r test --all');

    //Assert
    expect(stdout).to.equal(
      `${table([
        ['Pushed On', 'Tags', 'ARNs'],
        [
          moment(1725416968).format(),
          'main',
          'arn:aws:ecr:us-east-1:test-registry-id:repository/test:main',
        ],
        [
          moment(1725416068).format(),
          '1.0',
          'arn:aws:ecr:us-east-1:test-registry-id:repository/test:1.0',
        ],
        [
          moment(1725410968).format(),
          'feature/test',
          'arn:aws:ecr:us-east-1:test-registry-id:repository/test:feature/test',
        ],
      ])}\n`,
    );

    // No errors
    expect(stderr).to.equal('');
    if (!!error) {
      // Process exited with 0
      expect(error.message).to.equal('EEXIT: 0');
    }
  });
});
