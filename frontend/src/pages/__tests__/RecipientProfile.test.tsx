import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';

// â”€â”€â”€ Pure helpers extracted for testing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mapCert = (c: any) => ({
  ...c,
  cert_id: c.cert_id || c.id,
  issued_date: c.issued_date || c.issued_at,
});

const getInitials = (displayName: string, username: string) =>
  (displayName || username).slice(0, 2).toUpperCase();

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'recipient';

const buildLinkedInUrl = (cert: {
  cert_id: string;
  event_name: string;
  organization: string;
  issued_date: string;
}) => {
  const verifyUrl = `${window.location.origin}/verify/${cert.cert_id}`;
  const issued = new Date(cert.issued_date);
  return [
    'https://www.linkedin.com/profile/add',
    '?startTask=CERTIFICATION_NAME',
    `&name=${encodeURIComponent(cert.event_name)}`,
    `&organizationName=${encodeURIComponent(cert.organization)}`,
    `&issueYear=${issued.getFullYear()}`,
    `&issueMonth=${issued.getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(verifyUrl)}`,
    `&certId=${encodeURIComponent(cert.cert_id)}`,
  ].join('');
};

const filterCerts = (certs: any[], query: string) =>
  certs.filter(c =>
    `${c.event_name} ${c.organization} ${c.role}`.toLowerCase().includes(query.toLowerCase())
  );

// â”€â”€â”€ Arbitraries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 40 });

const arbCert = fc.record({
  cert_id: fc.uuid(),
  participant_name: arbNonEmptyString,
  event_name: arbNonEmptyString,
  organization: arbNonEmptyString,
  date_text: fc.constant(''),
  role: fc.constantFrom('Winner', 'Participant', 'Volunteer', 'Speaker', 'Organizer'),
  issued_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
    .map(d => d.toISOString()),
  verification_hash: fc.string({ minLength: 8, maxLength: 64 }),
});

const arbApiCert = fc.record({
  id: fc.uuid(),
  participant_name: arbNonEmptyString,
  event_name: arbNonEmptyString,
  organization: arbNonEmptyString,
  date_text: fc.constant(''),
  role: fc.constantFrom('Winner', 'Participant'),
  issued_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
    .map(d => d.toISOString()),
  verification_hash: fc.string({ minLength: 8, maxLength: 64 }),
});

// â”€â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('RecipientProfile â€” pure function properties', () => {

  // Feature: recipient-profile-page, Property 1: Cert field mapping preserves identity
  it('P1: mapCert maps idâ†’cert_id and issued_atâ†’issued_date, preserving other fields', () => {
    fc.assert(fc.property(arbApiCert, (c) => {
      const mapped = mapCert(c);
      expect(mapped.cert_id).toBe(c.id);
      expect(mapped.issued_date).toBe(c.issued_at);
      expect(mapped.event_name).toBe(c.event_name);
      expect(mapped.organization).toBe(c.organization);
      expect(mapped.role).toBe(c.role);
    }), { numRuns: 100 });
  });

  // Feature: recipient-profile-page, Property 2: Initials derivation
  it('P2: initials are first 2 chars of display_name uppercased', () => {
    fc.assert(fc.property(arbNonEmptyString, arbNonEmptyString, (displayName, username) => {
      const result = getInitials(displayName, username);
      expect(result).toBe(displayName.slice(0, 2).toUpperCase());
    }), { numRuns: 100 });
  });

  // Feature: recipient-profile-page, Property 7: LinkedIn URL contains required parameters
  it('P7: LinkedIn URL contains all 6 required parameters', () => {
    fc.assert(fc.property(arbCert, (cert) => {
      const url = buildLinkedInUrl(cert);
      const params = new URL(url).searchParams;
      expect(params.get('name')).toBe(cert.event_name);
      expect(params.get('organizationName')).toBe(cert.organization);
      expect(params.get('issueYear')).toBeTruthy();
      expect(params.get('issueMonth')).toBeTruthy();
      expect(params.get('certUrl')).toContain(cert.cert_id);
      expect(params.get('certId')).toBe(cert.cert_id);
    }), { numRuns: 100 });
  });

  // Feature: recipient-profile-page, Property 8: Search filter correctness
  it('P8: search filter returns exactly certs matching query in event_name, organization, or role', () => {
    fc.assert(fc.property(fc.array(arbCert, { minLength: 0, maxLength: 10 }), arbNonEmptyString, (certs, query) => {
      const result = filterCerts(certs, query);
      const q = query.toLowerCase();
      for (const cert of result) {
        const haystack = `${cert.event_name} ${cert.organization} ${cert.role}`.toLowerCase();
        expect(haystack).toContain(q);
      }
      for (const cert of certs) {
        const haystack = `${cert.event_name} ${cert.organization} ${cert.role}`.toLowerCase();
        if (haystack.includes(q)) {
          expect(result).toContainEqual(cert);
        }
      }
    }), { numRuns: 100 });
  });

  // Feature: recipient-profile-page, Property 9: Profile link uses slugified participant_name
  it('P9: slugify produces valid URL segment from any participant_name', () => {
    fc.assert(fc.property(arbNonEmptyString, (name) => {
      const slug = slugify(name);
      expect(slug.length).toBeGreaterThan(0);
      expect(slug.length).toBeLessThanOrEqual(24);
      expect(slug).toMatch(/^[a-z0-9_]+$/);
    }), { numRuns: 100 });
  });

});

// â”€â”€â”€ Unit tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('RecipientProfile â€” unit tests', () => {

  it('mapCert: cert_id already present is not overwritten', () => {
    const c = { cert_id: 'existing', id: 'other', issued_date: 'x', issued_at: 'y', event_name: 'E', organization: 'O', role: 'R', date_text: '', verification_hash: 'h', participant_name: 'P' };
    const mapped = mapCert(c);
    expect(mapped.cert_id).toBe('existing');
    expect(mapped.issued_date).toBe('x');
  });

  it('getInitials: single char name returns 1 char uppercased', () => {
    expect(getInitials('x', 'fallback')).toBe('X');
  });

  it('getInitials: falls back to username when displayName is empty', () => {
    expect(getInitials('', 'alice')).toBe('AL');
  });

  it('slugify: spaces become underscores', () => {
    expect(slugify('John Doe')).toBe('john_doe');
  });

  it('slugify: special chars are stripped', () => {
    expect(slugify('Alice@Example!')).toBe('alice_example');
  });

  it('slugify: max 24 chars', () => {
    const result = slugify('a'.repeat(50));
    expect(result.length).toBeLessThanOrEqual(24);
  });

  it('slugify: empty string returns "recipient"', () => {
    expect(slugify('')).toBe('recipient');
    expect(slugify('   ')).toBe('recipient');
  });

  it('filterCerts: empty query returns all certs', () => {
    const certs = [
      { event_name: 'Hackathon', organization: 'MIT', role: 'Winner', cert_id: '1', issued_date: '', date_text: '', participant_name: '', verification_hash: '' },
      { event_name: 'Summit', organization: 'Google', role: 'Speaker', cert_id: '2', issued_date: '', date_text: '', participant_name: '', verification_hash: '' },
    ];
    expect(filterCerts(certs, '')).toHaveLength(2);
  });

  it('filterCerts: case-insensitive match on event_name', () => {
    const certs = [
      { event_name: 'Hackathon', organization: 'MIT', role: 'Winner', cert_id: '1', issued_date: '', date_text: '', participant_name: '', verification_hash: '' },
      { event_name: 'Summit', organization: 'Google', role: 'Speaker', cert_id: '2', issued_date: '', date_text: '', participant_name: '', verification_hash: '' },
    ];
    expect(filterCerts(certs, 'HACK')).toHaveLength(1);
    expect(filterCerts(certs, 'HACK')[0].cert_id).toBe('1');
  });

  it('LinkedIn URL: issueYear and issueMonth are correct', () => {
    const cert = {
      cert_id: 'abc123',
      event_name: 'Test Event',
      organization: 'Test Org',
      issued_date: '2024-03-15T00:00:00.000Z',
    };
    const url = buildLinkedInUrl(cert);
    const params = new URL(url).searchParams;
    expect(params.get('issueYear')).toBe('2024');
    expect(params.get('issueMonth')).toBe('3');
  });

});
