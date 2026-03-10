import React from 'react'
import ReactTestRenderer from 'react-test-renderer'

jest.mock('../src/smokeCases', () => ({
    runSmokeCases: () => [
        {
            id: 'utf8-roundtrip',
            description: 'mocked result',
            expected: '"Hello Buffer World"',
            actual: '"Hello Buffer World"',
            pass: true,
        },
    ],
}))

import App from '../App'

test('renders the verification dashboard', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined

    await ReactTestRenderer.act(() => {
        tree = ReactTestRenderer.create(<App />)
    })

    expect(tree?.toJSON()).toBeTruthy()
})
