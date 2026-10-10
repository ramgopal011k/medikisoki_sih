import request from 'supertest';
import { app } from '../src/app';

async function test() {
  console.log('--- Testing /api/analytics/hospital/11111111-1111-1111-1111-111111111111 via supertest ---');
  const res = await request(app)
    .get('/api/analytics/hospital/11111111-1111-1111-1111-111111111111?range=7d')
    .set('Authorization', 'Bearer mock-doctor-token');

  console.log('Status:', res.status);
  console.log('Body:', res.body);

  const resNoAuth = await request(app)
    .get('/api/analytics/hospital/11111111-1111-1111-1111-111111111111?range=7d');
  console.log('No auth status:', resNoAuth.status);
  console.log('No auth body:', resNoAuth.body);

  process.exit(0);
}

test();
