import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const removedDirectories = ['packages/aws', 'workers', 'infra'];
const forbiddenDependencies = [
  '@aws-sdk/client-s3',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-sqs',
  '@aws-sdk/client-lambda',
  '@aws-sdk/lib-dynamodb',
  'aws-cdk',
  'aws-cdk-lib',
  '@types/aws-lambda',
  '@harness/aws',
];
const forbiddenConfiguration = ['HARNESS_TABLE_NAME', 'HARNESS_BUCKET_NAME', 'HARNESS_QUEUE_URL'];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.turbo'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

describe('local-only architecture', () => {
  it('contains no removed cloud packages, implementations, or configuration', async () => {
    for (const directory of removedDirectories) {
      expect(await exists(join(workspaceRoot, directory))).toBe(false);
    }

    const dependencyFiles = [
      join(workspaceRoot, 'package.json'),
      join(workspaceRoot, 'pnpm-lock.yaml'),
      ...(await collectFiles(join(workspaceRoot, 'apps'))).filter((path) =>
        path.endsWith('package.json'),
      ),
      ...(await collectFiles(join(workspaceRoot, 'packages'))).filter((path) =>
        path.endsWith('package.json'),
      ),
    ];
    const dependencyGraph = (
      await Promise.all(dependencyFiles.map((path) => readFile(path, 'utf8')))
    ).join('\n');
    for (const dependency of forbiddenDependencies) {
      expect(dependencyGraph).not.toContain(dependency);
    }

    const implementationFiles = [
      ...(await collectFiles(join(workspaceRoot, 'apps'))),
      ...(await collectFiles(join(workspaceRoot, 'packages'))),
    ].filter((path) => /\.(?:ts|tsx|json)$/u.test(path));
    const implementation = (
      await Promise.all(implementationFiles.map((path) => readFile(path, 'utf8')))
    ).join('\n');
    for (const setting of forbiddenConfiguration) expect(implementation).not.toContain(setting);
    expect(implementation).not.toMatch(/API Gateway|Cognito|public cloud endpoint/iu);
  });
});
