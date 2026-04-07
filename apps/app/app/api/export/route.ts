import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam), 500) : 100;

  const entries = await database.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No entries to export' }, { status: 404 });
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFontSize(20);
  doc.text('Microjournal', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `Exported on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${entries.length} entries`,
    margin,
    y
  );
  y += 12;

  doc.setTextColor(0);

  for (const entry of entries) {
    // Check if we need a new page (leave room for at least date + one line)
    if (y > 270) {
      doc.addPage();
      y = margin;
    }

    // Date + mood
    doc.setFontSize(9);
    doc.setTextColor(100);
    const dateStr = new Date(entry.createdAt).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const moodStr = entry.mood ? ` ${entry.mood}` : '';
    const sourceStr = entry.source === 'whatsapp' ? ' · WhatsApp' : '';
    doc.text(`${dateStr}${moodStr}${sourceStr}`, margin, y);
    y += 5;

    // Content
    doc.setFontSize(11);
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(entry.content, maxWidth);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }

    // Separator
    y += 4;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  const pdfBuffer = doc.output('arraybuffer');

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="microjournal-export-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
