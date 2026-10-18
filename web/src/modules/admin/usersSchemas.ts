// RED stub (plan 05-22): the Add User form's zod schema, written in the GREEN commit.
import { z } from 'zod';

export const createUserSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: z.string(),
  access: z.string(),
  temporaryPassword: z.string(),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;
