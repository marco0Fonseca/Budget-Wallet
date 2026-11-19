import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Environment Verification
//    *typescript;
//    *@types/node; 
//    *prisma. 
// included on package.json and finded by node_modules.

const projectRoot = new URL('../', import.meta.url);
const localRequire = createRequire(new URL('package.json', projectRoot));
const dependenciesDirectory = fileURLToPath(new URL('node_modules/', projectRoot));

type ProjectManifest = {
  devDependencies?: Record<string, string>;
};

test('declares and resolves development tools locally', async (t) => {
  const manifest: ProjectManifest = JSON.parse(
    await readFile(new URL('package.json', projectRoot), 'utf8'),
  );

  for (const dependency of ['typescript', '@types/node', 'prisma']) {
    await t.test(dependency, () => {
      assert.equal(typeof manifest.devDependencies?.[dependency], 'string');

      const installedManifest = localRequire.resolve(`${dependency}/package.json`);
      const relativePath = relative(dependenciesDirectory, installedManifest);

      assert.ok(!isAbsolute(relativePath));
      assert.ok(relativePath !== '..' && !relativePath.startsWith(`..${sep}`));
    });
  }
});
