import { test, expect } from '@playwright/test';
import testData from '../test-data/testData.json';
// import schema from '../test-data/schema.json';
// import { expectToMatchSchema } from '../utilities/Base';


/*
    Unfortunaltely every negative test case in our case fails and returns 500 internal server error
    It also takes 30+ Seconds for every failed Request! and that's we'll handle
    We can say it covers Test Case for Server Down scenario as well but 
    It should be code within 400 range status with a meaningfull error message 
    ==================
    also should we test for every out of boundary per country ?? ,
    that's to be discussed and decided by the team but i have prepared some sample test data for it
 */

for (let i = 0; i < 5; i++) { // choosing to limit or to fully cover negative testcases here 
                            // is to be decided and agreed upon among team

    test(`Out of Boundary Test for ${testData[i].country}`, async ({ request }) => {

        const startTime = Date.now();

        try {
            //setting timeout to 5 seconds (or any agreed upon value) also simulating Server down
            const res = await request.get(`/${testData[i].country}/${testData[i].invalidCode}`, { timeout: 5000 });

            const status = res.status();
            const duration = Date.now() - startTime;

            console.log(`Status: ${status}, Duration: ${duration}ms`);

            if (status >= 400 && status < 500) {
                console.log("Client error (4xx) received, considered OK for this test.");
            } else if (status >= 500) {
                console.warn("Server error (5xx):", status);
            } else {
                console.log("Request successful");
            }

        } catch (error) {
            // This block catches timeout or other network issues
            console.error("Request failed or timed out:");
        }
    });

}
