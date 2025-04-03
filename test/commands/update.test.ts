// import { runCommand } from '@oclif/test';
// import { expect } from 'chai';

// describe('update', () => {
//   it('updates an SSM parameter', async () => {
//     // Arrange
//     global.awsMocks.SSM.onFirstCall().resolves({
//       Parameters: [
//         {
//           Name: '/caccl-deploy/test/infraStackName',
//           Value: 'test-1',
//         },
//         {
//           Name: '/caccl-deploy/test/certificateArn',
//           Value: 'test-2',
//         },
//         {
//           Name: '/caccl-deploy/test/appImage',
//           Value: 'test-3',
//         },
//       ],
//     });
//     global.awsMocks.SSM.resolves({});

//     // Act
//     const { error, stdout, stderr } = await runCommand(
//       'update -a test key value',
//     );

//     // Assert
//     // No errors
//     expect(stderr).to.equal('');
//     // expect(error).to.be.null;
//     // expect(error?.message).to.be.null;
//     expect(stdout).to.contain('ssm parameter /caccl-deploy/test/key created');

//     // const expectedPutParamsOpts = {
//     //   Name: '/caccl-deploy/test/key',
//     //   Value: 'value',
//     //   Type: 'String',
//     //   Overwrite: true,
//     //   Description: 'Created and managed by caccl-deploy. ',
//     // };

//     expect(global.awsMocks.SSM.calledTwice).to.be.true;
//     // expect(putParameterSpy.calledWithMatch(expectedPutParamsOpts)).to.be.true;
//     global.awsMocks.SSM.reset();
//   });
// });
