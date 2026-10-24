import translateCode from '../../../../src/utils/postman-to-bruno-translator';
import postmanTranslation from '../../../../src/postman/postman-translations';

describe('Iteration data translation', () => {
  it.each([
    ['pm.iterationData.get("email");', 'bru.runner.iterationData.get("email");'],
    ['pm.iterationData.has("email");', 'bru.runner.iterationData.has("email");'],
    ['const row = pm.iterationData.toObject();', 'const row = bru.runner.iterationData.toObject();'],
    ['const row = pm.iterationData.toJSON();', 'const row = bru.runner.iterationData.toObject();'],
    ['const i = pm.info.iteration;', 'const i = bru.runner.iteration;'],
    ['const n = pm.info.iterationCount;', 'const n = bru.runner.iterationCount;']
  ])('translates %s', (code, expected) => {
    expect(translateCode(code)).toBe(expected);
    expect(postmanTranslation(code)).toBe(expected);
  });

  it('ends only the current iteration on setNextRequest(null), like Postman', () => {
    expect(translateCode('pm.setNextRequest(null);')).toBe('bru.runner.setNextRequest(null);');
    expect(translateCode('pm.execution.setNextRequest(null);')).toBe('bru.runner.setNextRequest(null);');
    expect(postmanTranslation('pm.setNextRequest(null);')).toBe('bru.runner.setNextRequest(null);');
    expect(postmanTranslation('pm.execution.setNextRequest(null);')).toBe('bru.runner.setNextRequest(null);');
  });
});
