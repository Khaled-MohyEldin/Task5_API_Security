import { expect } from '@playwright/test'
import Ajv from 'ajv';


export function expectToMatchSchema(data: any, schema: any) {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    expect(validate(data), JSON.stringify(validate.errors, null, 2)).toBe(true);
}
