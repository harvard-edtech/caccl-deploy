import { Stack, Construct } from '@aws-cdk/core';
import { StringParameter, ParameterType } from '@aws-cdk/aws-ssm';

// make this available to calling code
export { ParameterType };

export interface SsmExporetedParamSetProps {
  readonly paramPrefix: string,
  readonly paramValues: { [key: string]: string; };
  readonly paramType?: ParameterType;
};

export class SsmExportedParamSet extends Construct {

  readonly params: { [key: string]: StringParameter; };

  constructor(scope: Construct, id: string, props: SsmExporetedParamSetProps) {
    super(scope, id);

    const stackName = Stack.of(this).stackName;
    const {
      paramPrefix,
      paramValues,
      paramType = ParameterType.STRING,
    } = props;

    this.params = {};

    for (let [paramName, paramValue] of Object.entries(paramValues)) {
      this.params[paramName] = new StringParameter(this, `${paramName}Param`, {
        stringValue: paramValue,
        parameterName: `${paramPrefix}/${paramName}`,
        description: `${paramName} parameter for ${stackName} stack`,
        type: paramType,
      });
    }
  }
};

export interface SsmImportedParamSetProps {
  readonly paramPrefix: string,
  readonly paramNames: string[],
};

export class SsmImportedParamSet extends Construct {

  readonly paramValues: { [key: string]: string; };

  constructor(scope: Construct, id: string, props: SsmImportedParamSetProps) {
    super(scope, id);

    const { paramPrefix, paramNames } = props;

    this.paramValues = {};

    paramNames.forEach((paramName) => {
      const ssmParameterName = `${paramPrefix}/${paramName}`;
      const value = StringParameter.valueFromLookup(this, ssmParameterName);
      this.paramValues[paramName] = value;
    });
  }
};
