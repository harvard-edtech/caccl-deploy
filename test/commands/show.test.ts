import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('show', () => {
  it('runs show cmd', async () => {
    const {stdout} = await runCommand('show')
    expect(stdout).to.contain('hello world')
  })

  it('runs show --name oclif', async () => {
    const {stdout} = await runCommand('show --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
