// Sign-in codes are sent from Anna's own Gmail, so every email to a dead address bounces back
// into her inbox. Google Play's pre-launch report runs a robot ("Robo") over each new Android
// build, and it types made-up addresses such as crawlerrobo@gmail.com into the sign-in form.
// We catch those, and addresses that can never receive mail, before asking Supabase to send.

// Addresses automated test robots type into forms.
const ROBOT_ADDRESSES = new Set(['crawlerrobo@gmail.com']);

// Domains reserved for examples and testing (RFC 2606 / RFC 6761); mail to them never arrives.
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);
const RESERVED_TLDS = new Set(['test', 'example', 'invalid', 'localhost']);

// Common slips on the big mail providers' endings, such as "gmail.coma" or "gmail.comana".
const KNOWN_PROVIDERS = ['gmail', 'googlemail', 'icloud', 'me', 'mac', 'outlook', 'hotmail', 'live', 'yahoo', 'aol', 'proton', 'protonmail'];

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailProblem = 'invalid' | 'robot' | 'undeliverable' | 'typo';

/** Returns why we should not send a code to this address, or null if it looks fine. */
export function emailProblem(raw: string): EmailProblem | null {
  const email = raw.trim().toLowerCase();
  if (!SIMPLE_EMAIL.test(email)) return 'invalid';
  if (ROBOT_ADDRESSES.has(email)) return 'robot';

  const domain = email.slice(email.lastIndexOf('@') + 1);
  const labels = domain.split('.');
  const tld = labels[labels.length - 1];
  if (RESERVED_DOMAINS.has(domain) || labels.some((_, i) => RESERVED_DOMAINS.has(labels.slice(i).join('.')))) {
    return 'undeliverable';
  }
  if (RESERVED_TLDS.has(tld)) return 'undeliverable';

  // gmail.coma, icloud.coman: a known provider with letters stuck on after ".com".
  if (labels.length === 2 && KNOWN_PROVIDERS.includes(labels[0]) && tld.startsWith('com') && tld !== 'com') {
    return 'typo';
  }
  return null;
}

/** A short message for the sign-in screen, or null if the address looks fine. */
export function emailProblemMessage(raw: string): string | null {
  switch (emailProblem(raw)) {
    case 'invalid':
      return 'That does not look like an email address. Check it and try again.';
    case 'robot':
    case 'undeliverable':
      return 'We can’t send a code to that address. Please use your own email.';
    case 'typo':
      return 'Check the end of your email address. It looks like there’s a typo after ".com".';
    default:
      return null;
  }
}
