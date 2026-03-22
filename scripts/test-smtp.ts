import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

console.log('--- START SMTP TEST ---');
console.log('Current CWD:', process.cwd());

// Try to find .env file
const possiblePaths = [
  path.join(process.cwd(), 'server/.env'),
  path.join(__dirname, '../server/.env'),
  'C:\\Sem1_Year3_Projects\\auction-hub\\server\\.env',
];

let envPath = '';
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    break;
  }
}

if (!envPath) {
  console.error('Could not find .env file in:', possiblePaths);
  process.exit(1);
}

console.log('Found .env at:', envPath);

const envConfig: Record<string, string> = {};

try {
  const content = fs.readFileSync(envPath, 'utf-8');
  console.log('File size:', content.length);
  const lines = content.split(/\r?\n/); // Handle both CRLF and LF
  console.log('Line count:', lines.length);

  lines.forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const idx = line.indexOf('=');
    if (idx !== -1) {
      const key = line.substring(0, idx).trim();
      let value = line.substring(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      envConfig[key] = value;
    }
  });

  console.log('Parsed Keys:', Object.keys(envConfig));
} catch (e) {
  console.error('Error reading/parsing .env:', e);
  process.exit(1);
}

const smtpConfig = {
  host: envConfig['SMTP_HOST'],
  port: parseInt(envConfig['SMTP_PORT'] || '587'),
  user: envConfig['SMTP_USER'],
  pass: envConfig['SMTP_PASS'],
  from: envConfig['SMTP_FROM_EMAIL'],
  secure: envConfig['SMTP_SECURE'], // Keep as string or convert
};

console.log('Loaded SMTP Config:', {
  host: smtpConfig.host,
  port: smtpConfig.port,
  user: smtpConfig.user,
  secure: smtpConfig.secure,
  from: smtpConfig.from,
  passLength: smtpConfig.pass ? smtpConfig.pass.length : 0,
});

if (!smtpConfig.host) {
  console.error('SMTP_HOST is missing! Cannot proceed.');
  process.exit(1);
}

async function run() {
  const account = {
    user: smtpConfig.user,
    pass: smtpConfig.pass,
  };

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure === 'true',
    auth: {
      user: account.user,
      pass: account.pass,
    },
    debug: true, // Enable debug output
    logger: true, // Enable logger
  });

  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('Verification successful!');

    const recipient = process.argv[2] || smtpConfig.user;
    console.log(`Setting recipient to: ${recipient}`);

    const message = {
      from: smtpConfig.from || smtpConfig.user,
      to: recipient,
      subject: 'Test Email (SMTP Debug)',
      text: `This is a test email sent to ${recipient}.`,
      html: `<p>This is a test email sent to <b>${recipient}</b>.</p>`,
    };

    console.log('Sending mail...');
    const info = await transporter.sendMail(message);
    console.log('Mail sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (err: any) {
    console.error('FAILED to send email.');
    console.error('Error:', err.message);
    if (err.command) console.error('Command:', err.command);
    if (err.response) console.error('Response:', err.response);
    if (err.code) console.error('Code:', err.code);
  }
}

run();
