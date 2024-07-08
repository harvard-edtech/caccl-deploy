import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('connect', () => {
  it('runs connect cmd', async () => {
    const {stdout} = await runCommand('connect')
    expect(stdout).to.contain('hello world')
  })

  it('runs connect --name oclif', async () => {
    const {stdout} = await runCommand('connect --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
