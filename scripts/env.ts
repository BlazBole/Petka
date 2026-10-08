import {loadEnvConfig} from '@next/env';
// Enaka prednost .env.local > .env kot pri npm run dev.
loadEnvConfig(process.cwd(),true);
