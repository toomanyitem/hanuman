import translateBruToPostman from '../../../src/utils/bruno-to-postman-translator';

describe('Bruno to Postman iteration data translation', () => {
  it.each([
    ['bru.runner.iterationData.get("email");', 'pm.iterationData.get("email");'],
    ['bru.runner.iterationData.has("email");', 'pm.iterationData.has("email");'],
    ['const row = bru.runner.iterationData.toObject();', 'const row = pm.iterationData.toObject();'],
    ['const i = bru.runner.iteration;', 'const i = pm.info.iteration;'],
    ['const n = bru.runner.iterationCount;', 'const n = pm.info.iterationCount;']
  ])('translates %s', (code, expected) => {
    expect(translateBruToPostman(code)).toBe(expected);
  });
});
