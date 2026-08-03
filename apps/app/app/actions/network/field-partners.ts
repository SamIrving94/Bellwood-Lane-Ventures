'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export type FieldPartnerInput = {
  name: string;
  email: string;
  phone: string | null;
  background: string | null;
  postcodeAreas: string[];
  notes: string | null;
};

export async function createFieldPartner(input: FieldPartnerInput) {
  await requireFounder();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) throw new Error('Name and email are required');

  await database.fieldPartner.create({
    data: {
      name,
      email,
      phone: input.phone?.trim() || null,
      background: input.background?.trim() || null,
      postcodeAreas: input.postcodeAreas
        .map((a) => a.trim().toUpperCase())
        .filter(Boolean),
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath('/network');
}

export async function updateFieldPartner(
  id: string,
  input: Partial<FieldPartnerInput> & { active?: boolean }
) {
  await requireFounder();

  await database.fieldPartner.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined
        ? { email: input.email.trim().toLowerCase() }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.background !== undefined
        ? { background: input.background?.trim() || null }
        : {}),
      ...(input.postcodeAreas !== undefined
        ? {
            postcodeAreas: input.postcodeAreas
              .map((a) => a.trim().toUpperCase())
              .filter(Boolean),
          }
        : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });

  revalidatePath('/network');
}
