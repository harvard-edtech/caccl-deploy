import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('stack', () => {
  it('runs stack cmd', async () => {
    const {stdout} = await runCommand('stack')
    expect(stdout).to.contain('hello world')
  })

  it('runs stack --name oclif', async () => {
    const {stdout} = await runCommand('stack --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
