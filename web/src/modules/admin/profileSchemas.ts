// RED stub: the real schema lands in the GREEN commit.
import { z } from 'zod';

export const profileNameSchema = z.object({ firstName: z.string(), lastName: z.string() });

export type ProfileNameValues = z.infer<typeof profileNameSchema>;
