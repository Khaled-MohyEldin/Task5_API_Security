import { test, expect } from '@playwright/test';

test.use({ baseURL: 'https://stg-app.bosta.co' })

const payload = {
  "bankInfo": {
    "beneficiaryName": "test البنك الأهلي اليوناني - - NBG",
    "bankName": "bankName",
    "ibanNumber": "EG123456789012345678901234567",
    "accountNumber": "123",
    "مصر": "23456789012"
  },
  "paymentInfoOtp": "123"
}

test.describe('Test group', () => {
  test('seed', async ({ request }) => {

    //********Generating Token first**************/
    const res = await request.post("/api/v2/users/generate-token-for-interview-task");

    expect(res.status()).toBe(200);
    let resBody = await res.json();
    console.log(resBody.token);

    const token = resBody.token

    //******** Hitting add Bank info API **************/
    const res2 = await request.post("/api/v2/businesses/add-bank-info", {
      timeout: 3000,
      data: payload,
      headers: { 'Authorization': token }
    })

    let resBody2 = await res2.json();
    console.log(resBody2);
  });
});
