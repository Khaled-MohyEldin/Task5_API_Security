import { expect, test as base } from '@playwright/test'

import * as dotenv from 'dotenv';
import schema from '../test-data/schema.json';
import Ajv from 'ajv';


export function expectToMatchSchema(data: any, schema: any) {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    expect(validate(data), JSON.stringify(validate.errors, null, 2)).toBe(true);
}
