import request from 'supertest';
import app from '../src/app';

// Ensure the auth bypass works or we need to send the demo auth token.
// The app uses token-based auth for /api routes.
const DEMO_AUTH = 'Bearer medikiosk-demo-token';

describe('API Tests', () => {
  let sessionId: string;

  it('1. GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('2. GET /api/hospitals returns a list (array)', async () => {
    const res = await request(app).get('/api/hospitals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('3. POST /sessions with consents.clinicalCare === false returns 400/401', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', DEMO_AUTH)
      .send({ consents: { clinicalCare: false } });
    expect([400, 401]).toContain(res.status);
  });

  it('4. POST /sessions with valid consents returns 200/201 and a session ID', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', DEMO_AUTH)
      .send({ consents: { clinical_care: true, dpdp_processing: true } });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('data');
    sessionId = res.body.data.id || res.body.data.session_id;
    expect(sessionId).toBeDefined();
  });

  it('5. POST /history-facts with valid payload returns 200/201', async () => {
    const res = await request(app)
      .post('/history-facts')
      .set('Authorization', DEMO_AUTH)
      .send({ session_id: sessionId, question_id: 'q1', answer: 'Yes' });
    expect([200, 201]).toContain(res.status);
  });

  it('6. POST /ayush-assessment with valid payload returns 200/201 and reasoning object', async () => {
    const res = await request(app)
      .post('/ayush-assessment')
      .set('Authorization', DEMO_AUTH)
      .send({
        session_id: sessionId,
        prakriti: 'Vata-Pitta',
        vikriti: 'Vata',
        agni: 'Manda',
        koshtha: 'Krura',
        sara: 'Madhyama',
        samhanana: 'Avara',
        pramana: 'Madhyama',
        satmya: 'Madhyama',
        sattva: 'Pravara',
        ahara_shakti: 'Avara',
        vyayama_shakti: 'Madhyama',
        vaya: 'Madhyama'
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('reasoning');
    expect(res.body.reasoning).toHaveProperty('dominant_dosha');
    expect(res.body.reasoning).toHaveProperty('citations');
  }, 30000);

  it('7. GET /api/sessions without auth returns 401/403/404', async () => {
    const res = await request(app).get('/api/sessions');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('8. POST /sessions with malformed body returns 400/401', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', DEMO_AUTH)
      .send({ consents: 'not-an-object' });
    expect([400, 401]).toContain(res.status);
  });
});
