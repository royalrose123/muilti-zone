// 產生 users.json 用的密碼 hash：npm run hash -- <password>（PLAN §12.4）
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('用法：npm run hash -- <password>');
  process.exit(1);
}
const salt = randomBytes(16);
console.log(`scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`);
