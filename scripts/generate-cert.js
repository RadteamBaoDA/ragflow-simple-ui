#!/usr/bin/env node
/**
 * Generate self-signed SSL certificates for local development
 * Usage: node scripts/generate-cert.js
 * 
 * This creates certificates for the custom domain specified in .env
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from both be/.env and fe/.env
dotenv.config({ path: join(__dirname, '..', 'be', '.env') });
dotenv.config({ path: join(__dirname, '..', 'fe', '.env'), override: true });

const CERT_DIR = join(__dirname, '..', 'certs');
const DOMAIN = process.env.DEV_DOMAIN || 'localhost';
const ADDITIONAL_DOMAINS = (process.env.DEV_ADDITIONAL_DOMAINS || '').split(',').filter(Boolean);

// All domains to include in the certificate
const allDomains = [DOMAIN, ...ADDITIONAL_DOMAINS, 'localhost', '127.0.0.1'];
const uniqueDomains = [...new Set(allDomains)];

console.log('🔐 Generating SSL certificates for development...');
console.log(`📍 Domains: ${uniqueDomains.join(', ')}`);

// Create certs directory if it doesn't exist
if (!existsSync(CERT_DIR)) {
  mkdirSync(CERT_DIR, { recursive: true });
}

// Generate OpenSSL config for SAN (Subject Alternative Names)
const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = VN
ST = Ho Chi Minh
L = Ho Chi Minh City
O = Development
OU = Development
CN = ${DOMAIN}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
${uniqueDomains.map((d, i) => {
  if (d.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `IP.${i + 1} = ${d}`;
  }
  return `DNS.${i + 1} = ${d}`;
}).join('\n')}
`;

const configPath = join(CERT_DIR, 'openssl.cnf');
writeFileSync(configPath, opensslConfig);

const keyPath = join(CERT_DIR, 'key.pem');
const certPath = join(CERT_DIR, 'cert.pem');

try {
  // Generate private key and certificate
  execSync(`openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${keyPath}" \
    -out "${certPath}" \
    -config "${configPath}"`, {
    stdio: 'inherit',
  });

  console.log('\n✅ Certificates generated successfully!');
  console.log(`   📁 Certificate: ${certPath}`);
  console.log(`   🔑 Private Key: ${keyPath}`);
  console.log('\n📋 Next steps:');
  console.log('   1. Trust the certificate in your system:');
  console.log('      - Windows: Double-click cert.pem > Install Certificate > Local Machine > Trusted Root');
  console.log('      - macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/cert.pem');
  console.log('   2. Add to hosts file:');
  uniqueDomains.filter(d => d !== 'localhost' && !d.match(/^\d+\.\d+\.\d+\.\d+$/)).forEach(d => {
    console.log(`      127.0.0.1 ${d}`);
  });
  console.log('   3. Run: npm run dev:https');
} catch (error) {
  console.error('❌ Failed to generate certificates:', error.message);
  console.error('   Make sure OpenSSL is installed and available in PATH');
  process.exit(1);
}
