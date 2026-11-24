// RED stub: the Add Note rule lands in the GREEN commit.
import { z } from 'zod';

z.config({ jitless: true });

export const noteSchema = z.object({ text: z.string() });
