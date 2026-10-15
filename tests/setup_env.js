process.env.JWT_SECRET = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
delete process.env.SMTP_HOST; // tests must never send real mail