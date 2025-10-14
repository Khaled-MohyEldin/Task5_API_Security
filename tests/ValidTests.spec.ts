import { test, expect } from '@playwright/test';
import testData from '../test-data/testData.json';
import schema from '../test-data/schema.json';
import {expectToMatchSchema} from '../utilities/Base';

/* 
    Positive Test Cases =>  Data Driven 
    We Test At Least one valid Postal Code per country 
    so I have prepared some sample data 5 countrires and test takes 2.4s
    but in real world we should cover all 60+ of them
    automation Really helps us here it could take about 30 seconds for all of them
    ===================
    I have made Basic Schema but if i have swagger i could make it more detailed
    ===================
    also added some Case-insensitivity but i think it's low priority
    ============================
*/

for (const dataSet of testData) {

    test(`Valid inputs for ${dataSet.country}`, async ({ request }) => {

        const startingTime = Date.now();
        const res = await request.get(`/${dataSet.country}/${dataSet.code}`);
        //1. Validating Status Code and Status Text
        expect(res.statusText()).toBe("OK")
        expect(res.status()).toBe(200);

        //2. Validating Headers
        const resHeaders = res.headers();
        expect(resHeaders["content-type"]).toContain("application/json");

        const resBody = await res.json();
        // console.log(resBody);
        //3. Validating Response against Schema 
        expectToMatchSchema(resBody, schema);

        //4. Validating Response Time 
        const resTime = Date.now() - startingTime;
        expect(resTime).toBeLessThan(1000);

        //5. Validating some response values
        expect(resBody['country abbreviation']).toBe(dataSet.country);
        expect(resBody['post code']).toBe(dataSet.code);
        expect(resBody.places.length).toBeGreaterThanOrEqual(1); // we should have at least one place

    });

    //just more valid tests where country code can be case-insensitive (4 Combinations)

    test(`Case-insensitivity for ${dataSet.country}`, async ({ request }) => {

        const res = await request.get(`/${dataSet.country.toLowerCase()}/${dataSet.code}`);
        expect(res.statusText()).toBe("OK")
        expect(res.status()).toBe(200);
    });

}


