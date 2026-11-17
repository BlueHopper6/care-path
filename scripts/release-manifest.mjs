import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const revisionPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const packageList = ['carepath-frontend', 'carepath-backend'];

function repositoryName(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9_.-]{1,100}$/i.test(value) ||
    ['.', '..'].includes(value.split('/')[1])
  ) {
    throw new Error('Invalid release repository.');
  }
  return value.toLowerCase();
}

function runId(value) {
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,15}$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new Error('Invalid release run identity.');
  }
  return value;
}

async function githubGet(path, token, allowMissing = false, fetchImpl = fetch) {
  const response = await fetchImpl('https://api.github.com' + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok || Number(response.headers.get('content-length') || 0) > 131072) {
    throw new Error('Registry visibility could not be verified.');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.length;
      if (size > 131072) throw new Error('Registry visibility metadata exceeds its bound.');
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Registry visibility metadata is invalid.');
  }
}

export async function assertPrivatePackages({
  repository,
  token,
  mustExist = false,
  fetchImpl = fetch,
}) {
  const canonicalRepository = repositoryName(repository);
  if (!token) throw new Error('Registry visibility verification requires authentication.');
  const repo = await githubGet('/repos/' + canonicalRepository, token, false, fetchImpl);
  const [owner] = canonicalRepository.split('/');
  if (
    repo.full_name?.toLowerCase() !== canonicalRepository ||
    repo.owner?.login?.toLowerCase() !== owner ||
    !['User', 'Organization'].includes(repo.owner?.type)
  ) {
    throw new Error('Registry repository identity could not be verified.');
  }
  const scope = repo.owner.type === 'User' ? 'users' : 'orgs';

  for (const pkgName of packageList) {
    const info = await githubGet(
      `/${scope}/${owner}/packages/container/${encodeURIComponent(pkgName)}`,
      token,
      !mustExist,
      fetchImpl
    );
    if (info && (info.visibility !== 'private' || info.package_type !== 'container' || info.name !== pkgName)) {
      throw new Error(`Container package ${pkgName} must have private visibility.`);
    }
  }
  return true;
}

export function validatePublicBuildConfiguration(env) {
  let url;
  try {
    url = new URL(env.PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error('Invalid public Supabase URL configuration.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
  ) {
    throw new Error('Release requires the hosted HTTPS Supabase project URL.');
  }

  const key = env.PUBLIC_SUPABASE_KEY;
  if (typeof key !== 'string' || key.length > 4096) {
    throw new Error('A public Supabase key is required.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(key)) {
    try {
      const parts = key.split('.');
      if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
        throw new Error();
      }
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (claims.role !== 'anon') throw new Error();
    } catch {
      throw new Error('Only a public Supabase anon or publishable key may enter the build.');
    }
  }
  return true;
}

function extractDigest(image, repoDigests) {
  if (
    !Array.isArray(repoDigests) ||
    repoDigests.length > 50 ||
    repoDigests.some((value) => typeof value !== 'string' || value.length > 512)
  ) {
    throw new Error(`Invalid published image metadata for ${image}.`);
  }
  const matches = [...new Set(repoDigests.filter((value) => value.startsWith(image + '@')))];
  if (matches.length !== 1) {
    throw new Error(`Published image digest is missing or ambiguous for ${image}.`);
  }
  const digest = matches[0].slice(image.length + 1);
  if (!digestPattern.test(digest)) {
    throw new Error(`Invalid published image digest for ${image}.`);
  }
  return digest;
}

export function createReleaseManifest({
  repository,
  revision,
  verificationRunId,
  releaseRunId,
  frontendDigests,
  backendDigests,
}) {
  const canonicalRepository = repositoryName(repository);
  if (typeof revision !== 'string' || !revisionPattern.test(revision)) {
    throw new Error('Invalid release revision.');
  }
  const [owner] = canonicalRepository.split('/');
  const frontendImage = `ghcr.io/${owner}/carepath-frontend`;
  const backendImage = `ghcr.io/${owner}/carepath-backend`;

  return {
    schemaVersion: 1,
    repository: canonicalRepository,
    revision,
    verificationRunId: runId(verificationRunId),
    releaseRunId: runId(releaseRunId),
    frontend: {
      image: frontendImage,
      digest: extractDigest(frontendImage, frontendDigests),
    },
    backend: {
      image: backendImage,
      digest: extractDigest(backendImage, backendDigests),
    },
  };
}

async function main() {
  const command = process.argv[2];
  if (['check-registry-visibility', 'check-published-visibility'].includes(command)) {
    await assertPrivatePackages({
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.REGISTRY_TOKEN,
      mustExist: command === 'check-published-visibility',
    });
    console.log('Private registry publication policy verified.');
    return;
  }
  if (command === 'check-public-config') {
    validatePublicBuildConfiguration(process.env);
    console.log('Public release configuration validated.');
    return;
  }
  if (command !== 'write') throw new Error('Invalid release metadata command.');

  for (const file of ['frontend-digests.json', 'backend-digests.json']) {
    if (fs.statSync(file).size > 8192) {
      throw new Error(`Published image metadata exceeds its bound: ${file}`);
    }
  }
  const manifest = createReleaseManifest({
    repository: process.env.GITHUB_REPOSITORY,
    revision: process.env.VERIFIED_SHA,
    verificationRunId: process.env.VERIFICATION_RUN_ID,
    releaseRunId: process.env.GITHUB_RUN_ID,
    frontendDigests: JSON.parse(fs.readFileSync('frontend-digests.json', 'utf8')),
    backendDigests: JSON.parse(fs.readFileSync('backend-digests.json', 'utf8')),
  });
  fs.writeFileSync('release.json', JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  console.log('Published CarePath release manifest written.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
