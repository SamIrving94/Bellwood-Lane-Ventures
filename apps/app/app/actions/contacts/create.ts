'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

type CreateContactInput = {
  type: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  location?: string;
  notes?: string;
  tags?: string[];
};

export async function createContact(input: CreateContactInput) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const contact = await database.contact.create({
    data: {
      type: input.type,
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      location: input.location,
      notes: input.notes,
      tags: input.tags || [],
    },
  });

  revalidatePath('/contacts');

  return contact;
}
