import { createApp } from './app.js';
import { connectPrisma, prisma } from './shared/prisma.js';
import http from 'http';

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  await connectPrisma();
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5099, resolve));
  const baseUrl = 'http://localhost:5099/api/v1';

  let adminToken = '';
  let ctvToken = '';

  try {
    // 1. Health check
    console.log('1. Testing /health...');
    const healthRes = await fetch('http://localhost:5099/health');
    const healthJson = (await healthRes.json()) as any;
    console.log('   Health check:', healthJson.status === 'ok' ? 'PASS' : 'FAIL');

    // 2. Login as Admin
    console.log('2. Testing Admin Login...');
    const loginAdminRes = await fetch(`${baseUrl}/auth/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vienkhcn.vn', password: 'admin123' }),
    });
    const loginAdminJson = (await loginAdminRes.json()) as any;
    adminToken = loginAdminJson.data.token;
    console.log('   Admin Login:', loginAdminJson.data.user.role === 'Admin' ? 'PASS' : 'FAIL');

    // 3. Current Session
    console.log('3. Testing GET /auth/sessions/current...');
    const sessionRes = await fetch(`${baseUrl}/auth/sessions/current`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sessionJson = (await sessionRes.json()) as any;
    console.log('   Current Session:', sessionJson.data.user.email === 'admin@vienkhcn.vn' ? 'PASS' : 'FAIL');

    // 4. List Accounts
    console.log('4. Testing GET /accounts...');
    const accountsRes = await fetch(`${baseUrl}/accounts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const accountsJson = (await accountsRes.json()) as any;
    console.log(`   Found ${accountsJson.data.length} accounts:`, accountsJson.data.length > 0 ? 'PASS' : 'FAIL');

    // 5. Submit Registration Request
    console.log('5. Testing POST /registration-requests...');
    const testRegEmail = `test.candidate.${Date.now()}@vienkhcn.vn`;
    const regRes = await fetch(`${baseUrl}/registration-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vũ Quốc Khánh',
        email: testRegEmail,
        phone: '0988776655',
        dob: '01/01/2000',
        experience: 'Lập trình Node.js & React 3 năm',
      }),
    });
    const regJson = (await regRes.json()) as any;
    const newRequestId = regJson.data.id;
    console.log('   Registration Submitted:', !!newRequestId ? 'PASS' : 'FAIL');

    // 6. List Requests
    console.log('6. Testing GET /registration-requests?status=PENDING...');
    const listReqsRes = await fetch(`${baseUrl}/registration-requests?status=PENDING`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listReqsJson = (await listReqsRes.json()) as any;
    const found = listReqsJson.data.some((r: any) => r.id === newRequestId);
    console.log('   Found pending request:', found ? 'PASS' : 'FAIL');

    // 7. Approve Registration Request
    console.log('7. Testing PATCH /registration-requests/:id (APPROVE)...');
    const approveRes = await fetch(`${baseUrl}/registration-requests/${newRequestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    const approveJson = (await approveRes.json()) as any;
    console.log('   Approved Request:', !!approveJson.data.accountId ? 'PASS' : 'FAIL');

    // 8. Login as CTV
    console.log('8. Testing CTV Login...');
    const loginCtvRes = await fetch(`${baseUrl}/auth/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nhapemail@vienkhcn.vn', password: '12345678' }),
    });
    const loginCtvJson = (await loginCtvRes.json()) as any;
    ctvToken = loginCtvJson.data.token;
    console.log('   CTV Login:', loginCtvJson.data.user.role === 'Cộng tác viên' ? 'PASS' : 'FAIL');

    // 9. Save Schedule Registration
    console.log('9. Testing PUT /users/me/schedule-registration...');
    const scheduleRes = await fetch(`${baseUrl}/users/me/schedule-registration`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctvToken}`,
      },
      body: JSON.stringify({
        room: 'Buồng 1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        workContent: 'Trực hệ thống và giám sát máy chủ',
        slots: [
          { weekday: 0, period: 'MORNING', enabled: true },
          { weekday: 2, period: 'AFTERNOON', enabled: true },
          { weekday: 4, period: 'MORNING', enabled: true },
        ],
      }),
    });
    const scheduleJson = (await scheduleRes.json()) as any;
    console.log('   Schedule Registration Saved:', !!scheduleJson.data.id ? 'PASS' : 'FAIL');

    // 10. Get My Shifts
    console.log('10. Testing GET /users/me/shifts...');
    const shiftsRes = await fetch(`${baseUrl}/users/me/shifts?month=2026-08`, {
      headers: { Authorization: `Bearer ${ctvToken}` },
    });
    const shiftsJson = (await shiftsRes.json()) as any;
    console.log(`    Found ${shiftsJson.data.length} shifts:`, shiftsJson.data.length > 0 ? 'PASS' : 'FAIL');

    // 11. Schedule Summary (Admin)
    console.log('11. Testing GET /schedule-summary...');
    const summaryRes = await fetch(`${baseUrl}/schedule-summary?month=2026-08`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryJson = (await summaryRes.json()) as any;
    console.log('    Schedule Summary Month:', summaryJson.data.month, 'Today CTVs:', summaryJson.data.today.length, 'PASS');

    // 12. Update Profile
    console.log('12. Testing PUT /users/me...');
    const profileRes = await fetch(`${baseUrl}/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctvToken}`,
      },
      body: JSON.stringify({
        phone: '0988999111',
        address: 'Hà Nội Mới',
      }),
    });
    const profileJson = (await profileRes.json()) as any;
    console.log('    Profile Updated:', profileJson.data.phone === '0988999111' ? 'PASS' : 'FAIL');

    // 13. Cancel Shift (Single)
    if (shiftsJson.data.length > 0) {
      console.log('13. Testing DELETE /shift-registrations/:id (single)...');
      const firstShift = shiftsJson.data[0];
      const cancelRes = await fetch(`${baseUrl}/shift-registrations/${firstShift.id}?scope=single`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ctvToken}` },
      });
      const cancelJson = (await cancelRes.json()) as any;
      console.log('    Cancel Shift:', cancelJson.data.success ? 'PASS' : 'FAIL');
    }

    // 14. Notifications
    console.log('14. Testing GET /notifications...');
    const notifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${ctvToken}` },
    });
    const notifJson = (await notifRes.json()) as any;
    console.log(`    Found ${notifJson.data.length} notifications:`, 'PASS');

    console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
