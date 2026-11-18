const axios = require('axios');

const BASE_URL = 'http://localhost:4114/api/v1';

const roles = {
  superadmin: { username: 'admin', password: 'E7HHpQcEFezE4OAa1!' },
  hradmin: { username: 'hradmin_comp-001', password: 'SanaDemo@1404' },
  manager: { username: 'mgr_hq_comp-001', password: 'SanaDemo@1404' },
  employee: { username: 'mgr_hq_comp-001', password: 'SanaDemo@1404' }, // Using manager as employee for now
};

const endpoints = [
  // Auth
  { method: 'POST', path: '/auth/login', public: true },
  { method: 'POST', path: '/auth/refresh', public: true },
  { method: 'POST', path: '/auth/logout', auth: true },
  { method: 'GET', path: '/auth/me', auth: true },
  
  // Users
  { method: 'GET', path: '/users', roles: ['superadmin', 'hradmin'] },
  { method: 'GET', path: '/users/:id', roles: ['superadmin', 'hradmin'] },
  { method: 'POST', path: '/users', roles: ['superadmin', 'hradmin'] },
  { method: 'PATCH', path: '/users/:id', roles: ['superadmin', 'hradmin'] },
  { method: 'DELETE', path: '/users/:id', roles: ['superadmin'] },
  
  // Employees
  { method: 'GET', path: '/employees', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'GET', path: '/employees/:id', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'POST', path: '/employees', roles: ['superadmin', 'hradmin'] },
  { method: 'PATCH', path: '/employees/:id', roles: ['superadmin', 'hradmin'] },
  { method: 'DELETE', path: '/employees/:id', roles: ['superadmin', 'hradmin'] },
  
  // Leaves
  { method: 'GET', path: '/leaves/requests', roles: ['superadmin', 'hradmin', 'manager', 'employee'] },
  { method: 'POST', path: '/leaves/requests', roles: ['superadmin', 'hradmin', 'manager', 'employee'] },
  { method: 'POST', path: '/leaves/requests/:id/decide', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'DELETE', path: '/leaves/requests/:id', roles: ['superadmin', 'hradmin', 'manager', 'employee'] },
  { method: 'GET', path: '/leaves/balance', roles: ['superadmin', 'hradmin', 'manager', 'employee'] },
  
  // Payroll
  { method: 'GET', path: '/payroll/periods', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'POST', path: '/payroll/periods', roles: ['superadmin', 'hradmin'] },
  { method: 'POST', path: '/payroll/periods/:id/generate', roles: ['superadmin', 'hradmin'] },
  { method: 'POST', path: '/payroll/periods/:id/lock', roles: ['superadmin', 'hradmin'] },
  { method: 'GET', path: '/payroll/me/payslip/:periodId', roles: ['superadmin', 'hradmin', 'manager', 'employee'] },
  
  // Attendance
  { method: 'GET', path: '/attendance/records', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'POST', path: '/attendance/records', roles: ['superadmin', 'hradmin', 'manager'] },
  
  // Contracts
  { method: 'GET', path: '/contracts', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'POST', path: '/contracts', roles: ['superadmin', 'hradmin'] },
  
  // Dashboard
  { method: 'GET', path: '/dashboard/me', roles: ['superadmin', 'hradmin', 'manager', 'employee'] },
  { method: 'GET', path: '/dashboard/management', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'GET', path: '/dashboard/team-work', roles: ['superadmin', 'hradmin', 'manager'] },
  
  // Settings
  { method: 'GET', path: '/settings', roles: ['superadmin', 'hradmin'] },
  { method: 'PATCH', path: '/settings/:key', roles: ['superadmin', 'hradmin'] },
  
  // Org
  { method: 'GET', path: '/org/companies', roles: ['superadmin', 'hradmin'] },
  { method: 'GET', path: '/org/branches', roles: ['superadmin', 'hradmin', 'manager'] },
  { method: 'GET', path: '/org/org-units', roles: ['superadmin', 'hradmin', 'manager'] },
  
  // Audit
  { method: 'GET', path: '/audit-log', roles: ['superadmin', 'hradmin'] },
  
  // Backup
  { method: 'GET', path: '/backup/history', roles: ['superadmin'] },
  { method: 'POST', path: '/backup/run', roles: ['superadmin'] },
];

async function login(client, username, password) {
  const res = await client.post('/auth/login', { username, password });
  return res.data.data.accessToken;
}

async function testEndpoint(client, token, method, path, expectedRoles) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await client.request({ method, url: path, headers, validateStatus: () => true });
    return { status: res.status, allowed: res.status < 400 };
  } catch (error) {
    return { status: 0, allowed: false, error: error.message };
  }
}

async function main() {
  const client = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  
  // Login as each role
  const tokens = {};
  for (const [role, creds] of Object.entries(roles)) {
    try {
      tokens[role] = await login(client, creds.username, creds.password);
      console.log(`✅ Logged in as ${role}`);
    } catch (error) {
      console.error(`❌ Failed to login as ${role}: ${error.message}`);
      tokens[role] = null;
    }
  }
  
  console.log('\n🔐 AUTHORIZATION MATRIX TEST');
  console.log('='.repeat(100));
  
  const results = [];
  let unexpectedAllows = 0;
  let unexpectedDenies = 0;
  
  for (const endpoint of endpoints) {
    const path = endpoint.path.replace(/:id/g, '1').replace(/:periodId/g, '1');
    const method = endpoint.method;
    const allowedRoles = endpoint.roles || [];
    const isPublic = endpoint.public === true;
    
    // Test with each role
    for (const role of Object.keys(roles)) {
      const token = tokens[role];
      if (!token && !isPublic) continue;
      
      const shouldAllow = isPublic || allowedRoles.includes(role);
      const result = await testEndpoint(client, token, method, path, allowedRoles);
      const actualAllow = result.allowed;
      
      let status = '✅';
      if (shouldAllow && !actualAllow) {
        status = '❌ UNEXPECTED DENY';
        unexpectedDenies++;
      } else if (!shouldAllow && actualAllow) {
        status = '❌ UNEXPECTED ALLOW';
        unexpectedAllows++;
      }
      
      results.push({
        method,
        path,
        role,
        expected: shouldAllow ? 'ALLOW' : 'DENY',
        actual: actualAllow ? 'ALLOW' : 'DENY',
        status,
        httpStatus: result.status,
      });
      
      if (status !== '✅') {
        console.log(`${status} ${method} ${path} | Role: ${role} | Expected: ${shouldAllow ? 'ALLOW' : 'DENY'} | Actual: ${actualAllow ? 'ALLOW' : 'DENY'} (HTTP ${result.status})`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('📋 AUTHORIZATION MATRIX SUMMARY');
  console.log('='.repeat(100));
  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Passed: ${results.filter(r => r.status === '✅').length}`);
  console.log(`❌ Unexpected Allows (BLOCKER): ${unexpectedAllows}`);
  console.log(`❌ Unexpected Denies: ${unexpectedDenies}`);
  
  // Save detailed results
  const fs = require('fs');
  fs.writeFileSync('authz-matrix-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed results saved to authz-matrix-results.json');
  
  if (unexpectedAllows > 0) {
    console.log('\n⚠️  BLOCKER: Unexpected allows found! These are security issues.');
    process.exit(1);
  }
}

main().catch(console.error);