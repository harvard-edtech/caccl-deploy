import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import CacclDeploy = require('../deploy/lib/infra-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CacclDeploy.CacclInfraStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
