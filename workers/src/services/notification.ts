/**
 * Notification Service — Resend API & VCALENDAR (.ics) Generator
 *
 * Diseñado para ejecutarse en Cloudflare Workers sin dependencias externas pesadas.
 */

export interface CalendarEventPayload {
  uid: string;
  summary: string;
  description: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  organizerEmail?: string;
  organizerName?: string;
}

/**
 * Formatea una fecha UTC al formato iCalendar (YYYYMMDDTHHmmssZ)
 */
export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Genera el contenido textual de un archivo VCALENDAR (.ics)
 */
export function generateIcsContent(event: CalendarEventPayload): string {
  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(event.startAt);
  const dtEnd = formatIcsDate(event.endAt);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bookly SaaS//Booking Engine//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.summary.replace(/\n/g, '\\n')}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    event.location ? `LOCATION:${event.location.replace(/\n/g, '\\n')}` : '',
    event.organizerEmail
      ? `ORGANIZER;CN=${event.organizerName || 'Bookly'}:mailto:${event.organizerEmail}`
      : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

/**
 * Genera el enlace directo a WhatsApp (wa.me)
 */
export function generateWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedText}`;
}

export interface SendAppointmentEmailParams {
  apiKey: string;
  from?: string;
  to: string;
  customerName: string;
  companyName: string;
  serviceName: string;
  staffName?: string | null;
  startAt: Date;
  endAt: Date;
  appointmentId: number;
}

/**
 * Envía email transaccional de confirmación con archivo .ics adjunto vía Resend API
 */
export async function sendAppointmentConfirmationEmail(
  params: SendAppointmentEmailParams,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!params.apiKey) {
    console.warn('[Resend] RESEND_API_KEY no configurada. Omitiendo envío de email.');
    return { success: false, error: 'API_KEY_MISSING' };
  }

  const icsContent = generateIcsContent({
    uid: `bookly-apt-${params.appointmentId}@bookly.ghostlyapps.dev`,
    summary: `Cita: ${params.serviceName} en ${params.companyName}`,
    description: `Hola ${params.customerName}, tu cita para ${params.serviceName} está confirmada con ${params.staffName || 'el equipo de ' + params.companyName}.`,
    location: params.companyName,
    startAt: params.startAt,
    endAt: params.endAt,
    organizerName: params.companyName,
  });

  const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0f172a;">
      <h2 style="color: #10b981;">¡Tu cita está confirmada!</h2>
      <p>Hola <strong>${params.customerName}</strong>,</p>
      <p>Tu cita en <strong>${params.companyName}</strong> ha sido agendada con éxito.</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Servicio:</strong> ${params.serviceName}</p>
        <p style="margin: 5px 0;"><strong>Especialista:</strong> ${params.staffName || 'Cualquiera disponible'}</p>
        <p style="margin: 5px 0;"><strong>Fecha y Hora:</strong> ${params.startAt.toUTCString()}</p>
        <p style="margin: 5px 0;"><strong>Código de Reserva:</strong> #${params.appointmentId}</p>
      </div>

      <p style="font-size: 14px; color: #64748b;">
        Adjuntamos tu archivo de calendario <code>cita.ics</code> para que puedas agregarlo automáticamente a Google Calendar, Apple Calendar u Outlook.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">Bookly SaaS — Agendamiento inteligente de citas</p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from || 'Bookly <citas@bookly.ghostlyapps.dev>',
        to: [params.to],
        subject: `Confirmación de Cita #${params.appointmentId} — ${params.companyName}`,
        html: htmlBody,
        attachments: [
          {
            filename: 'cita.ics',
            content: icsBase64,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Resend Error]', errText);
      return { success: false, error: errText };
    }

    const data = (await response.json()) as { id: string };
    return { success: true, id: data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Resend Exception]', message);
    return { success: false, error: message };
  }
}
