import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('apps', () => {
  it('runs apps cmd', async () => {
    const {stdout} = await runCommand('apps')
    expect(stdout).to.contain('hello world')
  })

  it('runs apps --name oclif', async () => {
    const {stdout} = await runCommand('apps --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
