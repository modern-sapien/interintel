import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const toolDefinitions = require('./definitions.json');

export default toolDefinitions;
