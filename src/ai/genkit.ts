import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // apiVersion: 'v1beta', // Removed to use stable API and fix model not found error.
    }),
  ],
});
