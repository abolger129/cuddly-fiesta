// Supabase Edge Function: keep and cancel the Sign in with Apple token.
//
// Apple asks apps that offer Sign in with Apple to revoke the person's Apple
// token when they delete their account. Revoking needs a refresh token, which
// only comes from swapping the one-time authorization code the app gets at
// sign-in, and that swap needs a secret signed with the app's Apple key. So:
//
// { action: 'save', authorization_code } right after Sign in with Apple swaps
// the code for a refresh token and keeps it in the apple_tokens table.
//
// { action: 'revoke' } just before the account is deleted cancels the saved
// token. If nothing is saved (people who signed in before this existed) it
// answers { revoked: false, needs_code: true }, and the app asks Apple for a
// fresh code and calls { action: 'revoke', authorization_code }.
//
// Needs APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (the whole .p8
// file) as function secrets; see docs/sign-in-setup.md. APPLE_CLIENT_ID
// defaults to the app's bundle ID.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// Apple ------------------------------------------------------------------------

const clientId = Deno.env.get('APPLE_CLIENT_ID') ?? 'com.abolger129.thegauntlet';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

let cachedSecret: { value: string; expiresAt: number } | null = null;

/**
 * Apple's "client secret" is a short-lived JWT signed (ES256) with the
 * Sign in with Apple key from the developer account.
 */
async function clientSecret(): Promise<string> {
  if (cachedSecret && cachedSecret.expiresAt > Date.now() + 60_000) return cachedSecret.value;

  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!teamId || !keyId || !privateKey) {
    throw new AppleNotSetUp();
  }

  // Accept the .p8 file as pasted, with real line breaks or "\n".
  const pem = privateKey.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60; // Apple allows up to six months; an hour is plenty.
  const unsigned = `${encodeJson({ alg: 'ES256', kid: keyId })}.${encodeJson({
    iss: teamId,
    iat: now,
    exp: now + expiresIn,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  })}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  );
  const value = `${unsigned}.${base64url(new Uint8Array(signature))}`;
  cachedSecret = { value, expiresAt: (now + expiresIn) * 1000 };
  return value;
}

class AppleNotSetUp extends Error {
  constructor() {
    super('Sign in with Apple tokens are not set up yet: add the APPLE_ function secrets');
  }
}

async function apple(path: string, params: Record<string, string>) {
  return await fetch(`https://appleid.apple.com/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: await clientSecret(), ...params }),
  });
}

/** Swap a one-time authorization code (valid five minutes) for a refresh token. */
async function exchangeCode(code: string) {
  const response = await apple('token', { grant_type: 'authorization_code', code });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.refresh_token) {
    throw new Error(`Apple did not accept the sign-in code (${body.error ?? response.status})`);
  }
  // The id_token comes straight from Apple over HTTPS, so its claims can be read as is.
  const claims = JSON.parse(atob(body.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return { refreshToken: body.refresh_token as string, appleUserId: claims.sub as string };
}

async function revokeToken(refreshToken: string) {
  const response = await apple('revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Apple did not revoke the token (${body.error ?? response.status})`);
  }
}

// Requests ---------------------------------------------------------------------

/** The person's Apple user id, or null if they never used Sign in with Apple. */
async function appleIdentityOf(userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const identity = data.user?.identities?.find((i) => i.provider === 'apple');
  if (!identity) return null;
  return (identity.identity_data?.sub as string | undefined) ?? identity.id;
}

/** A code from someone else's Apple account mustn't be saved or revoked here. */
async function exchangeOwnCode(userId: string, code: string) {
  const [token, appleUserId] = await Promise.all([exchangeCode(code), appleIdentityOf(userId)]);
  if (token.appleUserId !== appleUserId) {
    await revokeToken(token.refreshToken).catch(() => {});
    throw new Error('That Apple account is not the one linked to this account');
  }
  return token.refreshToken;
}

async function save(userId: string, code: string) {
  const refreshToken = await exchangeOwnCode(userId, code);
  const { error } = await admin
    .from('apple_tokens')
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() });
  if (error) throw error;
  return json({ saved: true });
}

async function revoke(userId: string, code: unknown) {
  const { data: saved } = await admin
    .from('apple_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  let refreshToken = saved?.refresh_token as string | undefined;
  if (typeof code === 'string' && code) {
    refreshToken = await exchangeOwnCode(userId, code);
  }
  if (!refreshToken) {
    const usesApple = (await appleIdentityOf(userId)) !== null;
    return json({ revoked: false, needs_code: usesApple });
  }

  // Already revoked or expired tokens still count as done for Apple.
  await revokeToken(refreshToken);
  if (saved) await admin.from('apple_tokens').delete().eq('user_id', userId);
  return json({ revoked: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth.user) return json({ error: 'You need to be signed in' }, 401);

    const { action, authorization_code } = await req.json();
    if (action === 'save' && typeof authorization_code === 'string') {
      return await save(auth.user.id, authorization_code);
    }
    if (action === 'revoke') return await revoke(auth.user.id, authorization_code);
    return json({ error: "Send action 'save' (with authorization_code) or 'revoke'" }, 400);
  } catch (e) {
    if (e instanceof AppleNotSetUp) return json({ error: e.message, not_set_up: true }, 503);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
