// spec: API Security Tests - Bank Info Endpoint
import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

test.describe('Bank Info API Security Tests', () => {
    // Store token for the test suite
    let validToken: string;

    // Base valid payload
    const validPayload = {
        bankInfo: {
            beneficiaryName: "test البنك الأهلي اليوناني - - NBG",
            bankName: "bankName",
            ibanNumber: "EG123456789012345678901234567",
            accountNumber: "123",
            "مصر": "23456789012"
        },
        paymentInfoOtp: "123"
    };

    // Setup: Get a valid token before tests
    test.beforeAll(async ({ request }) => {
        const res = await request.post("/api/v2/users/generate-token-for-interview-task");
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        validToken = body.token;
        console.log('Generated token for tests:', validToken);
    });

    // Helper to make authenticated requests
    async function makeAuthRequest(
        request: APIRequestContext,
        payload: any,
        token: string | null = validToken
    ) {
        const headers: Record<string, string> = {
            'content-type': 'application/json'
        };
        if (token) headers['Authorization'] = token;

        const res = await request.post("/api/v2/businesses/add-bank-info", {
            data: payload,
            headers,
            timeout: 5000
        });

        return {
            response: res,
            status: res.status(),
            body: await res.text().catch(() => '')
        };
    }

    test('1. Control - Valid request succeeds', async ({ request }) => {
        const { status, body } = await makeAuthRequest(request, validPayload);
        expect(status).toBeLessThan(500);
        console.log('Control response:', body);
    });

    test('2. Authentication checks', async ({ request }) => {
        // No token
        const noToken = await makeAuthRequest(request, validPayload, null);
        expect(noToken.status).toBe(401);

        // Invalid token formats
        const tokenChecks = [
            'INVALID_TOKEN_123',
            validToken + '_tampered',
            'null',
            'undefined',
            '\'OR \'1\'=\'1'
        ];

        for (const badToken of tokenChecks) {
            const { status, body } = await makeAuthRequest(request, validPayload, badToken);
            expect(status).toBeLessThan(500);
            expect(status).not.toBe(200);
            expect(body.toLowerCase()).not.toContain('stack');
            console.log(`Invalid token "${badToken}" response:`, body);
        }
    });

    test('3. SQL Injection attempts in bank details', async ({ request }) => {
        const sqlInjections = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "\'); DROP TABLE bank_accounts; --",
            "' UNION SELECT * FROM bank_accounts; --"
        ];

        for (const injection of sqlInjections) {
            const payload = {
                ...validPayload,
                bankInfo: {
                    ...validPayload.bankInfo,
                    beneficiaryName: injection,
                    bankName: injection,
                    accountNumber: injection
                }
            };

            const { status, body } = await makeAuthRequest(request, payload);
            console.log(body); 
            expect(status).toBeLessThan(500);
            expect(body.toLowerCase()).not.toContain('sql');
            // expect(body.toLowerCase()).not.toContain('error');
            expect(body.toLowerCase()).not.toContain('stack');
            console.log(`SQL injection "${injection}" response:`, body);
        }
    });

    test('4. XSS attempts in bank name fields', async ({ request }) => {
        const xssPayloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            '<img src="x" onerror="alert(1)">',
            '"><script>alert(document.cookie)</script>'
        ];

        for (const xss of xssPayloads) {
            const payload = {
                ...validPayload,
                bankInfo: {
                    ...validPayload.bankInfo,
                    beneficiaryName: xss,
                    bankName: xss
                }
            };

            const { status, body } = await makeAuthRequest(request, payload);
            expect(status).toBeLessThan(500);
            // Response shouldn't reflect our XSS payload
            expect(body).not.toContain('<script>');
            console.log(`XSS attempt "${xss}" response:`, body);
        }
    });

    test('5. IBAN/Account number format attacks', async ({ request }) => {
        const invalidFormats = [
            { iban: '', account: '' }, // Empty
            { iban: 'invalid', account: 'invalid' }, // Invalid format
            { iban: '0'.repeat(1000), account: '0'.repeat(1000) }, // Buffer overflow attempt
            { iban: '../../../etc/passwd', account: '../../../etc/passwd' }, // Path traversal
            { iban: '${SYSTEM_ENV_VAR}', account: '#{SYSTEM_VAR}' }, // Template injection
            { iban: 'null', account: 'undefined' } // JS/null injection
        ];

        for (const { iban, account } of invalidFormats) {
            const payload = {
                ...validPayload,
                bankInfo: {
                    ...validPayload.bankInfo,
                    ibanNumber: iban,
                    accountNumber: account
                }
            };

            const { status, body } = await makeAuthRequest(request, payload);
            expect(status).toBeLessThan(500);
            expect(body.toLowerCase()).not.toContain('stack');
            console.log(`Invalid format IBAN="${iban}" ACC="${account}" response:`, body);
        }
    });

    test('6. Payload structure attacks', async ({ request }) => {
        const malformedPayloads = [
            {}, // Empty payload
            { bankInfo: null }, // Null bankInfo
            { bankInfo: {}, paymentInfoOtp: null }, // Empty bank info
            { ...validPayload, extraField: 'injection' }, // Extra fields
            { bankInfo: [], paymentInfoOtp: {} }, // Wrong types
            { bankInfo: validPayload.bankInfo } // Missing OTP
        ];

        for (const payload of malformedPayloads) {
            const { status, body } = await makeAuthRequest(request, payload);
            expect(status).toBeLessThan(500);
            expect(body.toLowerCase()).not.toContain('stack');
            console.log(`Malformed payload ${JSON.stringify(payload)} response:`, body);
        }
    });

    test('7. Unicode/Special char attacks', async ({ request }) => {
        const specialChars = [
            { name: 'Null byte', value: 'test\0injection' },
            { name: 'Unicode RTL', value: '‮test' },
            { name: 'Zero-width', value: '​test​' },
            { name: 'Emoji', value: '🏦 bank 💰' }
        ];

        for (const { name, value } of specialChars) {
            const payload = {
                ...validPayload,
                bankInfo: {
                    ...validPayload.bankInfo,
                    beneficiaryName: value,
                    bankName: value
                }
            };

            const { status, body } = await makeAuthRequest(request, payload);
            expect(status).toBeLessThan(500);
            console.log(`Special chars "${name}" response:`, body);
        }
    });

    test('8. Rapid requests for rate limiting', async ({ request }) => {
        const promises = Array(10).fill(0).map(() =>
            makeAuthRequest(request, validPayload)
        );

        const results = await Promise.all(promises);

        // Check if any requests were rate limited
        const statusCodes = results.map(r => r.status);
        console.log('Rate limit test status codes:', statusCodes);

        // All responses should be controlled
        results.forEach(({ status, body }) => {
            expect(status).toBeLessThan(500);
            expect(body.toLowerCase()).not.toContain('stack');
        });
    });

    test('9. OTP bypass attempts', async ({ request }) => {
        const otpBypass = [
            '', // Empty
            '000000', // Common default
            '111111', // Sequential
            'null', // null string
            '${ENV}', // Template injection
            '0'.repeat(100) // Long input
        ];

        for (const otp of otpBypass) {
            const payload = {
                ...validPayload,
                paymentInfoOtp: otp
            };

            const { status, body } = await makeAuthRequest(request, payload);
            expect(status).toBeLessThan(500);
            expect(status).not.toBe(200);
            console.log(`OTP bypass "${otp}" response:`, body);
        }
    });

    test('10. Check for data exposure in errors', async ({ request }) => {
        // Try to trigger detailed errors that might expose internals
        const payload = {
            ...validPayload,
            bankInfo: {
                ...validPayload.bankInfo,
                ibanNumber: 'INVALID_IBAN_TO_TRIGGER_ERROR'
            }
        };

        const { status, body } = await makeAuthRequest(request, payload);
        expect(status).toBeLessThan(500);

        // Error shouldn't contain sensitive information
        const sensitiveTerms = ['sql', 'error:', 'stack', 'line', 'at module', 'exception'];
        for (const term of sensitiveTerms) {
            expect(body.toLowerCase()).not.toContain(term);
        }

        console.log('Error exposure test response:', body);
    });

});