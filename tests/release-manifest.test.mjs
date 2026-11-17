import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPrivatePackages,
  validatePublicBuildConfiguration,
  createReleaseManifest,
} from '../scripts/release-manifest.mjs';

test('validatePublicBuildConfiguration accepts anon key and rejects service role key', () => {
  const anonJwt =
    'eyJhbGciOiJIUzI1NiJ9.' +
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') +
    '.sig';
  assert.equal(
    validatePublicBuildConfiguration({
      PUBLIC_SUPABASE_URL: 'https://proj123.supabase.co',
      PUBLIC_SUPABASE_KEY: anonJwt,
    }),
    true
  );

  const serviceJwt =
    'eyJhbGciOiJIUzI1NiJ9.' +
    Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') +
    '.sig';
  assert.throws(() =>
    validatePublicBuildConfiguration({
      PUBLIC_SUPABASE_URL: 'https://proj123.supabase.co',
      PUBLIC_SUPABASE_KEY: serviceJwt,
    })
  );
});

test('createReleaseManifest binds frontend and backend digests', () => {
  const sha = 'a'.repeat(40);
  const feDigest = 'sha256:' + '1'.repeat(64);
  const beDigest = 'sha256:' + '2'.repeat(64);
  const manifest = createReleaseManifest({
    repository: 'BlueHopper6/CarePath',
    revision: sha,
    verificationRunId: '100',
    releaseRunId: '200',
    frontendDigests: [`ghcr.io/bluehopper6/carepath-frontend@${feDigest}`],
    backendDigests: [`ghcr.io/bluehopper6/carepath-backend@${beDigest}`],
  });
  assert.equal(manifest.repository, 'bluehopper6/carepath');
  assert.equal(manifest.frontend.digest, feDigest);
  assert.equal(manifest.backend.digest, beDigest);
});

test('assertPrivatePackages enforces private visibility for both packages', async () => {
  const makeFetch = (backendVis) => async (url) => {
    if (url.endsWith('/repos/bluehopper6/carepath')) {
      return new Response(
        JSON.stringify({
          full_name: 'BlueHopper6/CarePath',
          owner: { login: 'BlueHopper6', type: 'User' },
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/packages/container/carepath-frontend')) {
      return new Response(
        JSON.stringify({ name: 'carepath-frontend', package_type: 'container', visibility: 'private' }),
        { status: 200 }
      );
    }
    if (url.endsWith('/packages/container/carepath-backend')) {
      return new Response(
        JSON.stringify({ name: 'carepath-backend', package_type: 'container', visibility: backendVis }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  };

  assert.equal(
    await assertPrivatePackages({
      repository: 'BlueHopper6/CarePath',
      token: 'tok',
      mustExist: true,
      fetchImpl: makeFetch('private'),
    }),
    true
  );

  await assert.rejects(() =>
    assertPrivatePackages({
      repository: 'BlueHopper6/CarePath',
      token: 'tok',
      mustExist: true,
      fetchImpl: makeFetch('public'),
    })
  );
});
