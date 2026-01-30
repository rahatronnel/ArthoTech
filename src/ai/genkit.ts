import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
        apiVersion: 'v1beta', // To use models like Gemini 1.5 Pro
    }),
  ],
});
