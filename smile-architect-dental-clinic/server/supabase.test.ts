import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.ts';

test('isSupabaseConfigured supports SUPABASE_URL with SUPABASE_KEY fallback', () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevPub = process.env.SUPABASE_PUBLISHABLE_KEY;
  const prevKey = process.env.SUPABASE_KEY;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  const prevSecret = process.env.SUPABASE_SECRET_KEY;

  try {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SECRET_KEY;

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'sb_publishable_test_key';

    assert.equal(isSupabaseConfigured(), true);
    assert.ok(getSupabaseClient() !== null);

    delete process.env.SUPABASE_KEY;
    assert.equal(isSupabaseConfigured(), false);
  } finally {
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;

    if (prevPub === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = prevPub;

    if (prevKey === undefined) delete process.env.SUPABASE_KEY;
    else process.env.SUPABASE_KEY = prevKey;

    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;

    if (prevSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevSecret;
  }
});
